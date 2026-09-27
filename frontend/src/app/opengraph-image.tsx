import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DeepSea Guardian — AI-Powered Ocean Monitoring";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #020617 0%, #0b1f3a 55%, #0e7490 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            fontSize: 34,
            color: "#7dd3fc",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(56,189,248,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            ~
          </div>
          DeepSea Guardian
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          Protecting the Ocean with Artificial Intelligence
        </div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#bae6fd" }}>
          AI-powered ocean monitoring, prediction & conservation
        </div>
      </div>
    ),
    size
  );
}
