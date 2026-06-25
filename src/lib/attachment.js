 





















export function formatBytes(n) {
  if (!n) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(k)));
  return `${(n / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function kindFromMime(mime) {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

// Exact MIME types that are allowed to be uploaded. Notably excludes
// image/svg+xml and text/html, which can carry stored-XSS payloads when served
// from the Cloudinary domain and opened directly.
const ALLOWED_MIME = new Set([
  // Images (no SVG)
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/bmp",
  // Audio
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
  // Video
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
]);

/** Whether a client-declared MIME type is permitted for upload. */
export function isAllowedMime(mime) {
  return ALLOWED_MIME.has(String(mime || "").toLowerCase());
}

// Cloudinary detects the real format from file contents, so we re-check it
// after upload. These formats are rejected (and the asset destroyed) even if
// the client lied about the MIME type.
const BLOCKED_FORMATS = new Set([
  "svg",
  "html",
  "htm",
  "xhtml",
  "xml",
  "js",
  "mjs",
  "swf",
]);

/** Whether a Cloudinary-detected format is dangerous to serve inline. */
export function isBlockedFormat(format) {
  return BLOCKED_FORMATS.has(String(format || "").toLowerCase());
}
