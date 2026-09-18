import { ImageResponse } from "next/og";

export const alt = "Pinflix — Live TV Without Borders";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at 78% 22%, rgba(139,92,246,.55) 0%, rgba(139,92,246,0) 34%), radial-gradient(circle at 18% 72%, rgba(255,67,93,.42) 0%, rgba(255,67,93,0) 38%), #07070a",
        color: "#f8f7f4",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 22 }}>
          <div
            style={{
              alignItems: "center",
              background: "linear-gradient(135deg, #ff6b7d 0%, #ff304f 52%, #7c4dff 100%)",
              borderRadius: 28,
              display: "flex",
              height: 96,
              justifyContent: "center",
              width: 96,
            }}
          >
            <div
              style={{
                borderBottom: "19px solid transparent",
                borderLeft: "31px solid white",
                borderTop: "19px solid transparent",
                display: "flex",
                marginLeft: 8,
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: 94, fontWeight: 800, letterSpacing: 7 }}>
            PINFLIX
          </div>
        </div>
        <div style={{ color: "#d0ced8", display: "flex", fontSize: 34, letterSpacing: -1 }}>
          Live TV without borders.
        </div>
        <div
          style={{
            color: "#ff7183",
            display: "flex",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 5,
            textTransform: "uppercase",
          }}
        >
          WORLDWIDE · LIVE · PUBLIC STREAMS
        </div>
      </div>
    </div>,
    size,
  );
}
