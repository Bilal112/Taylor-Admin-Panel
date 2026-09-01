import type { MetadataRoute } from "next";

// PWA manifest — makes the app installable ("Add to Home Screen") on the
// counter phone/tablet and customer phones. Served at /manifest.webmanifest
// with the <link> injected automatically by Next. Deliberately no service
// worker yet: install + standalone window only, no offline caching.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taylor App",
    short_name: "Taylor App",
    description: "Tailoring made simple — orders, appointments and tracking.",
    start_url: "/",
    display: "standalone",
    background_color: "#111827",
    theme_color: "#1a56db",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
