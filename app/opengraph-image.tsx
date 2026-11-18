import { ImageResponse } from "next/og";
import { getLogoDataUrl } from "@/lib/favicon-image";
import { siteConfig } from "@/lib/site-config";

export const alt = "Linkto: see which creators drive clicks, signups and sales";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STEPS = ["Click", "Visit", "Signup", "Purchase"];

/** Social sharing card (WhatsApp, LinkedIn, X, Slack link previews). */
export default async function OpenGraphImage() {
  const logo = await getLogoDataUrl();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0a0a0f 0%, #0b1220 60%, #0c2233 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={logo} width={72} height={72} alt="" style={{ borderRadius: 16 }} />
          <div style={{ display: "flex", marginLeft: 20, fontSize: 40, fontWeight: 700 }}>
            {siteConfig.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            See which creators drive clicks, signups and sales.
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 30, color: "#94a3b8" }}>
            No referral codes. No coupon tracking. One snippet.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          {STEPS.map((step, i) => (
            <div key={step} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  padding: "12px 28px",
                  borderRadius: 999,
                  fontSize: 28,
                  fontWeight: 600,
                  color: "#a5f3fc",
                  background: "rgba(34, 211, 238, 0.14)",
                  border: "2px solid rgba(34, 211, 238, 0.45)",
                }}
              >
                {step}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ display: "flex", margin: "0 16px", fontSize: 30, color: "#475569" }}>
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
