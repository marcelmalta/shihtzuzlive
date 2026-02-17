import TopBar from "@/components/TopBar";
import Image from "next/image";

export default function Home() {
  return (
    <div>
      {/* Topo com botões: Assistir Live (YouTube) + Enviar foto */}
      <TopBar showLiveLink showSubmit submitHref="/submit" />

      <main style={{ maxWidth: 980, margin: "18px auto", padding: 16 }}>
        <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
          <Image
            src="/brand/logo-horizontal.jpg"
            alt="ShihTzuz"
            width={900}
            height={360}
            style={{ width: "100%", height: "auto", borderRadius: 16 }}
            priority
          />

          <div style={{ color: "var(--muted)", display: "grid", gap: 10 }}>
            <div>
              Envie a foto do seu Shih Tzu em <b>/submit</b> e assista o mural em <b>/live</b> (OBS).
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <a
                href="/submit"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 44,
                  padding: "0 16px",
                  borderRadius: 14,
                  textDecoration: "none",
                  fontWeight: 900,
                  color: "#0b0f14",
                  background: "linear-gradient(180deg, #f6d88a 0%, #d6b25c 100%)",
                  border: "1px solid rgba(0,0,0,.25)",
                  boxShadow: "0 14px 40px rgba(214,178,92,.18), 0 10px 30px rgba(0,0,0,.18)",
                }}
              >
                Enviar foto
              </a>

              <a
                href="/live"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 44,
                  padding: "0 16px",
                  borderRadius: 14,
                  textDecoration: "none",
                  fontWeight: 900,
                  color: "#ffffff",
                  background: "rgba(255,255,255,.08)",
                  border: "1px solid rgba(255,255,255,.14)",
                }}
              >
                Abrir /live (OBS)
              </a>

              <a
                href="https://www.youtube.com/@ShihTZuz"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 44,
                  padding: "0 16px",
                  borderRadius: 14,
                  textDecoration: "none",
                  fontWeight: 900,
                  color: "#ffffff",
                  background: "rgba(255,45,45,.14)",
                  border: "1px solid rgba(255,45,45,.35)",
                }}
              >
                Assistir Live (YouTube)
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
