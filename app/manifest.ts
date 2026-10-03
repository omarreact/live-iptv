import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pinflix TV",
    short_name: "Pinflix TV",
    description: "Live television with automatic source fallback.",
    start_url: "/",
    display: "standalone",
    background_color: "#030305",
    theme_color: "#030305",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}