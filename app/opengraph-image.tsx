import { ImageResponse } from "next/og";

export const alt = "Pinflix — Live TV";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "radial-gradient(circle at 70% 25%, #29292f 0%, #09090b 55%)",
        color: "#f3f2ee",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", fontSize: 112, letterSpacing: -5 }}>Pinflix</div>
      <div style={{ color: "#a7a6a0", display: "flex", fontSize: 32, letterSpacing: 6 }}>
        THE WORLD, ON AIR
      </div>
    </div>,
    size,
  );
}
