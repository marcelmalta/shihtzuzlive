import TopBar from "@/components/TopBar";
import Image from "next/image";

export default function Home() {
  return (
    <div>
      <TopBar />

      <div style={{ maxWidth: 980, margin: "18px auto", padding: 16 }}>
        <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
          <Image
            src="/brand/logo-horizontal.png"
            alt="ShihTzuz"
            width={900}
            height={360}
            style={{ width: "100%", height: "auto", borderRadius: 16 }}
            priority
          />

          <div style={{ color: "var(--muted)" }}>
            Use o <b>/submit</b> para enviar fotos e o <b>/live</b> no OBS.
          </div>
        </div>
      </div>
    </div>
  );
}
