// Web App Manifest — Next.js serves this at /manifest.webmanifest and injects
// the <link rel="manifest"> tag automatically. Icons are real PNGs in /public
// (regenerate with `node scripts/gen-pwa-icons.mjs`).
export default function manifest() {
  return {
    name: "SWM",
    short_name: "SWM",
    description:
      "Assign, track, review and evaluate tasks across all school stakeholders.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    categories: ["productivity", "education", "business"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
