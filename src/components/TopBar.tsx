import Image from "next/image";
import Link from "next/link";

export default function TopBar() {
  return (
    <div className="topbar">
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
        <Image
          src="/brand/logo-badge.png"
          alt="ShihTzuz"
          width={44}
          height={44}
          priority
        />
        <div>
          <div className="title-font" style={{ fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
            ShihTzuz
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Cuidados • Rotina • Diversão</div>
        </div>
      </Link>

      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/submit" className="btn-gold" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          Enviar foto
        </Link>
        <Link href="/live" style={{ color: "var(--muted)", textDecoration: "none", fontWeight: 700 }}>
          Live
        </Link>
      </div>
    </div>
  );
}
