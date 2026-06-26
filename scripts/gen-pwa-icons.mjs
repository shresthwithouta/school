// Generates the PWA app icons as real PNG files in /public, with no extra
// dependencies (pure Node: zlib + fs). Re-run with `node scripts/gen-pwa-icons.mjs`
// whenever the brand mark changes.
//
// Design: full-bleed indigo gradient tile (matches the app's --primary) with a
// centered white checkmark. Full-bleed + centered mark inside the safe zone, so
// the same files work as both "any" and "maskable" icons.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

// ── PNG encoding ──────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression/filter/interlace = 0
  // Add filter byte 0 to the start of each scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Drawing helpers ─────────────────────────────────────────────────────────
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// Distance from point p to segment a-b.
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp01(t);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Brand colors (indigo gradient + white mark).
const TOP = [99, 102, 241]; // #6366f1
const BOTTOM = [67, 56, 202]; // #4338ca

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  // Checkmark geometry in normalized [0,1] coords (well within the safe zone).
  const pts = [
    [0.30, 0.53],
    [0.44, 0.67],
    [0.72, 0.35],
  ].map(([x, y]) => [x * size, y * size]);
  const half = 0.062 * size; // stroke half-width
  const aa = Math.max(1, size / 160); // anti-alias band

  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const bg = [
      Math.round(lerp(TOP[0], BOTTOM[0], t)),
      Math.round(lerp(TOP[1], BOTTOM[1], t)),
      Math.round(lerp(TOP[2], BOTTOM[2], t)),
    ];
    for (let x = 0; x < size; x++) {
      const d = Math.min(
        distToSeg(x, y, pts[0][0], pts[0][1], pts[1][0], pts[1][1]),
        distToSeg(x, y, pts[1][0], pts[1][1], pts[2][0], pts[2][1]),
      );
      const cov = smoothstep(half + aa, half - aa, d); // 1 inside the stroke
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(lerp(bg[0], 255, cov));
      rgba[i + 1] = Math.round(lerp(bg[1], 255, cov));
      rgba[i + 2] = Math.round(lerp(bg[2], 255, cov));
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(PUBLIC, { recursive: true });
const outputs = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-icon-180.png", 180],
];
for (const [name, size] of outputs) {
  writeFileSync(join(PUBLIC, name), render(size));
  console.log(`wrote public/${name} (${size}x${size})`);
}
