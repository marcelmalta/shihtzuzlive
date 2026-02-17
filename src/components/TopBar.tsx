"use client";

import Image from "next/image";

type Props = {
  showLiveLink?: boolean;
  showSubmit?: boolean;
  submitHref?: string;
};

export default function TopBar({
  showLiveLink = true,
  showSubmit = true,
  submitHref = "/submit",
}: Props) {
  const ytLive = "https://www.youtube.com/@ShihTZuz";

  return (
    <header style={bar}>
      <div style={left}>
        <div style={logoWrap}>
          <Image
            src="/brand/logo-badge.png"
            alt="ShihTZuz"
            width={44}
            height={44}
            style={{ borderRadius: 12 }}
            priority
          />
        </div>

        <div style={brandText}>
          <div style={title}>ShihTZuz</div>
          <div style={sub}>Cuidados • Rotina • Diversão</div>
        </div>
      </div>

      <div style={right}>
        {showLiveLink && (
          <a
            href={ytLive}
            target="_blank"
            rel="noreferrer"
            style={liveBtn}
            title="Abrir canal no YouTube"
          >
            <span style={dot} />
            Assistir Live
          </a>
        )}

        {showSubmit && (
          <a href={submitHref} style={submitBtn}>
            Enviar foto
          </a>
        )}
      </div>
    </header>
  );
}

const bar: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  height: 72,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 18px",
  background:
    "linear-gradient(180deg, rgba(10,14,20,.92) 0%, rgba(10,14,20,.78) 100%)",
  borderBottom: "1px solid rgba(255,255,255,.10)",
  backdropFilter: "blur(10px)",
};

const left: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 260,
};

const logoWrap: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(0,0,0,.35)",
  border: "1px solid rgba(255,255,255,.10)",
  boxShadow: "0 10px 40px rgba(0,0,0,.35)",
};

const brandText: React.CSSProperties = { lineHeight: 1.1 };

const title: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: 0.2,
  color: "#fff",
};

const sub: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.86,
  color: "#e9eefc",
  marginTop: 4,
};

const right: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const liveBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  height: 44,
  padding: "0 14px",
  borderRadius: 14,
  textDecoration: "none",
  fontWeight: 900,
  color: "#fff",
  background: "rgba(255,255,255,.08)",
  border: "1px solid rgba(255,255,255,.14)",
};

const dot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#ff2d2d",
  boxShadow: "0 0 0 4px rgba(255,45,45,.18)",
};

const submitBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 46,
  padding: "0 18px",
  borderRadius: 16,
  textDecoration: "none",
  fontWeight: 950,
  color: "#0b0f14",
  background: "linear-gradient(180deg, #f6d88a 0%, #d6b25c 100%)",
  border: "1px solid rgba(0,0,0,.25)",
  boxShadow: "0 14px 40px rgba(214,178,92,.22), 0 10px 30px rgba(0,0,0,.25)",
};
