import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Milestone Rewards – Set goals. Earn rewards.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #fdf6f9 0%, #f8e4ee 50%, #f0d0e0 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -40, right: 100, width: 400, height: 400, borderRadius: "50%", background: "#d4829e", opacity: 0.04, display: "flex" }} />
        <div style={{ position: "absolute", bottom: -60, left: 60, width: 320, height: 320, borderRadius: "50%", background: "#d4829e", opacity: 0.04, display: "flex" }} />

        {/* Left content */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 80px", flex: 1 }}>
          {/* Mini app icon */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 20px rgba(212,130,158,0.2)",
                fontSize: 30,
              }}
            >
              ✓
            </div>
            <div style={{ marginLeft: 16, fontSize: 16, color: "#9a8898", letterSpacing: 4, textTransform: "uppercase" as const, fontWeight: 300, display: "flex" }}>
              Weight Goals App
            </div>
          </div>

          {/* Title */}
          <div style={{ fontSize: 56, fontWeight: 600, color: "#4a3848", fontStyle: "italic", lineHeight: 1.15, display: "flex", flexDirection: "column" }}>
            <span>Milestone</span>
            <span>Rewards</span>
          </div>

          {/* Tagline */}
          <div style={{ fontSize: 20, color: "#9a8898", marginTop: 20, letterSpacing: 3, fontWeight: 300, display: "flex" }}>
            SET GOALS · EARN REWARDS
          </div>

          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", marginTop: 40, width: 400 }}>
            <div style={{ width: 400, height: 14, borderRadius: 7, background: "rgba(212,130,158,0.15)", display: "flex", position: "relative", overflow: "hidden" }}>
              <div style={{ width: 260, height: 14, borderRadius: 7, background: "linear-gradient(90deg, #d4829e, #e0a0b8)", display: "flex" }} />
            </div>
          </div>

          {/* Milestone markers below bar */}
          <div style={{ display: "flex", gap: 28, marginTop: 14, marginLeft: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6aaa88", display: "flex" }} />
              <span style={{ fontSize: 13, color: "#9a8898" }}>75kg</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6aaa88", display: "flex" }} />
              <span style={{ fontSize: 13, color: "#9a8898" }}>70kg</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#d4829e", display: "flex" }} />
              <span style={{ fontSize: 13, color: "#d4829e", fontWeight: 600 }}>65kg</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(212,130,158,0.3)", display: "flex" }} />
              <span style={{ fontSize: 13, color: "#c8b8c4" }}>60kg</span>
            </div>
          </div>
        </div>

        {/* Right side: Floating cards */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: 80, gap: 20, width: 460 }}>
          {/* Card 1 - completed */}
          <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 20, padding: "18px 24px", boxShadow: "0 4px 24px rgba(212,130,158,0.12)", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2.5px solid #6aaa88", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#6aaa88", flexShrink: 0 }}>✓</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ fontSize: 20, color: "#4a3848", fontStyle: "italic", textDecoration: "line-through", opacity: 0.5 }}>75 kg</span>
              <span style={{ fontSize: 13, color: "#9a8898" }}>Spa day</span>
            </div>
            <span style={{ fontSize: 24 }}>🎯✨</span>
          </div>

          {/* Card 2 - completed */}
          <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 20, padding: "18px 24px", boxShadow: "0 4px 24px rgba(212,130,158,0.12)", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2.5px solid #6aaa88", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#6aaa88", flexShrink: 0 }}>✓</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ fontSize: 20, color: "#4a3848", fontStyle: "italic", textDecoration: "line-through", opacity: 0.5 }}>70 kg</span>
              <span style={{ fontSize: 13, color: "#9a8898" }}>New shoes</span>
            </div>
            <span style={{ fontSize: 24 }}>🎯⭐</span>
          </div>

          {/* Card 3 - next goal -->  */}
          <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 20, padding: "18px 24px", boxShadow: "0 4px 24px rgba(212,130,158,0.12)", border: "1.5px solid #f0c8d8", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2.5px dashed rgba(212,130,158,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ fontSize: 20, color: "#4a3848", fontStyle: "italic" }}>65 kg</span>
              <span style={{ fontSize: 13, color: "#d4829e" }}>Weekend getaway</span>
            </div>
            <span style={{ fontSize: 24 }}>🎁</span>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 8, background: "linear-gradient(90deg, #d4829e, #e0a0b8, #f0c8d8)", opacity: 0.5, display: "flex" }} />
      </div>
    ),
    { ...size }
  );
}
