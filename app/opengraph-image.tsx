import { ImageResponse } from "next/og";

export const alt = "Pinflix — Watch the world live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0A0A0B",
        color: "#F5F5F7",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ alignItems: "center", display: "flex", gap: 22 }}>
          <div
            style={{
              alignItems: "center",
              background: "#FF4D4D",
              borderRadius: 24,
              display: "flex",
              height: 88,
              justifyContent: "center",
              width: 88,
            }}
          >
            <div
              style={{
                borderBottom: "17px solid transparent",
                borderLeft: "28px solid white",
                borderTop: "17px solid transparent",
                display: "flex",
                marginLeft: 7,
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, letterSpacing: 6 }}>
            PINFLIX
          </div>
        </div>
        <div style={{ color: "#A1A1A6", display: "flex", fontSize: 34 }}>
          Watch the world live.
        </div>
      </div>
    </div>,
    size,
  );
}
