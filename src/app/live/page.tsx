"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { QRCodeCanvas } from "qrcode.react";

type WallPhoto = {
  id: string;
  created_at: string;
  display_name: string | null;
  instagram: string | null;
  facebook: string | null;
  caption: string | null;
  storage_path: string;
  status: "pending" | "approved" | "rejected";
};

const W = 1920;
const H = 1080;

export default function LivePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";

  const submitUrl =
    process.env.NEXT_PUBLIC_SUBMIT_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/submit` : "/submit");

  // duração por foto (ms). padrão 10s
  const rotateMs = Number(process.env.NEXT_PUBLIC_LIVE_ROTATE_MS || 10000);

  const [queue, setQueue] = useState<WallPhoto[]>([]);
  const [current, setCurrent] = useState<WallPhoto | null>(null);
  const [imgUrl, setImgUrl] = useState<string>("");

  // pra transição suave
  const [fadeKey, setFadeKey] = useState<string>("init");
  const timerRef = useRef<any>(null);

  async function getUrl(path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function loadApproved() {
    const { data, error } = await supabase
      .from("wall_photos")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(80);

    if (!error && data) {
      const arr = data as WallPhoto[];
      setQueue(arr);
      setCurrent(arr[0] || null);
    }
  }

  useEffect(() => {
    loadApproved();

    const ch = supabase
      .channel("wall-photos-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "wall_photos" }, (payload) => {
        const row = (payload.new || payload.old) as WallPhoto;
        if (!row) return;

        if (row.status === "approved") {
          setQueue((q) => {
            const exists = q.some((x) => x.id === row.id);
            const next = exists ? q.map((x) => (x.id === row.id ? row : x)) : [row, ...q];
            return next.slice(0, 120);
          });
          setCurrent((c) => c || row);
        } else {
          setQueue((q) => q.filter((x) => x.id !== row.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [supabase]);

  // rotação
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCurrent((c) => {
        if (!queue.length) return null;
        if (!c) return queue[0];
        const idx = queue.findIndex((x) => x.id === c.id);
        return queue[(idx + 1) % queue.length] || queue[0];
      });
    }, rotateMs);

    return () => timerRef.current && clearInterval(timerRef.current);
  }, [queue, rotateMs]);

  // carregar URL da imagem e disparar fade
  useEffect(() => {
    (async () => {
      if (!current) {
        setImgUrl("");
        return;
      }
      const url = await getUrl(current.storage_path);
      setImgUrl(url);
      setFadeKey(current.id + ":" + Date.now());
    })();
  }, [current?.id]);

  const socials = formatSocials(current);

  return (
    <div style={outer}>
      {/* CANVAS 1920x1080 fixo (perfeito para OBS) */}
      <div style={canvas}>
        {/* Top bar */}
        <div style={topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/brand/logo-badge.png" alt="ShihTzuz" style={{ width: 40, height: 40 }} />
            <div>
              <div style={{ fontWeight: 900, letterSpacing: 0.5, fontSize: 22 }}>ShihTzuz</div>
              <div style={{ opacity: 0.78, fontSize: 14 }}>Cuidados • Rotina • Diversão</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={pillLive}>● Live</div>
            <div style={{ opacity: 0.9, fontSize: 14 }}>Aprovados: <b>{queue.length}</b></div>
            <a href="/submit" style={btnGold}>Enviar foto</a>
          </div>
        </div>

        {/* Palco */}
        <div style={stage}>
          {/* Fundo glow */}
          <div style={glow} />

          {/* Imagem */}
          <div style={photoFrame}>
            {imgUrl ? (
              <img
                key={fadeKey}
                src={imgUrl}
                alt="Shih Tzu"
                style={photo}
              />
            ) : (
              <div style={{ color: "#cfd7e6", opacity: 0.9, fontSize: 20 }}>
                Aguardando fotos aprovadas…
              </div>
            )}
          </div>

          {/* Lower third */}
          {current && (
            <div style={lowerThird}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 30, lineHeight: 1.1 }}>
                    {current.display_name || "Seguidor"}
                  </div>

                  {socials ? (
                    <div style={{ marginTop: 6, fontSize: 16, opacity: 0.9 }}>
                      {socials}
                    </div>
                  ) : null}

                  {current.caption ? (
                    <div style={{ marginTop: 10, fontSize: 20, opacity: 0.95, maxWidth: 1320 }}>
                      “{current.caption}”
                    </div>
                  ) : null}
                </div>

                {/* QR */}
                <div style={qrCard}>
                  <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 10, textAlign: "center" }}>
                    Envie a foto do seu Shih Tzu
                  </div>
                  <div style={{ display: "grid", placeItems: "center" }}>
                    <QRCodeCanvas value={submitUrl} size={160} includeMargin />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85, textAlign: "center" }}>
                    {shortUrl(submitUrl)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer discreto */}
        <div style={footer}>
          <span style={{ opacity: 0.7 }}>OBS Browser Source • /live • {rotateMs / 1000}s por foto</span>
        </div>
      </div>
    </div>
  );
}

/* helpers */

function formatSocials(p: WallPhoto | null) {
  if (!p) return "";
  const parts: string[] = [];

  if (p.instagram) {
    const v = p.instagram.startsWith("@") ? p.instagram : `@${p.instagram}`;
    parts.push(`Instagram: ${v}`);
  }
  if (p.facebook) {
    parts.push(`Facebook: ${p.facebook}`);
  }
  return parts.join("  •  ");
}

function shortUrl(u: string) {
  try {
    const url = new URL(u);
    return `${url.host}${url.pathname}`;
  } catch {
    return u;
  }
}

/* styles */

const outer: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  background: "#050608",
  display: "grid",
  placeItems: "center",
};

const canvas: React.CSSProperties = {
  width: W,
  height: H,
  position: "relative",
  overflow: "hidden",
  background: "radial-gradient(1200px 800px at 20% 15%, rgba(255,204,102,.08), transparent 60%), #050608",
  color: "#fff",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  boxShadow: "0 30px 120px rgba(0,0,0,.65)",
};

const topbar: React.CSSProperties = {
  height: 84,
  padding: "0 26px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid rgba(255,255,255,.08)",
  background: "linear-gradient(180deg, rgba(8,10,14,.92), rgba(8,10,14,.62))",
  backdropFilter: "blur(10px)",
};

const pillLive: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 14,
  background: "rgba(255, 77, 77, .14)",
  border: "1px solid rgba(255, 77, 77, .35)",
  color: "#ffdddd",
};

const btnGold: React.CSSProperties = {
  textDecoration: "none",
  padding: "10px 16px",
  borderRadius: 14,
  fontWeight: 900,
  color: "#111",
  background: "linear-gradient(180deg, #ffd38a, #d8a83d)",
  border: "1px solid rgba(255,255,255,.18)",
};

const stage: React.CSSProperties = {
  position: "relative",
  height: H - 84 - 42,
  display: "grid",
  placeItems: "center",
};

const glow: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(700px 500px at 55% 45%, rgba(255, 208, 122, .12), transparent 60%), radial-gradient(600px 400px at 30% 60%, rgba(255, 208, 122, .06), transparent 65%)",
  pointerEvents: "none",
};

const photoFrame: React.CSSProperties = {
  width: 980,
  height: 660,
  borderRadius: 24,
  background: "rgba(0,0,0,.35)",
  border: "1px solid rgba(255,255,255,.10)",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  boxShadow: "0 30px 120px rgba(0,0,0,.55)",
};

const photo: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  animation: "fadeIn .55s ease",
};

const lowerThird: React.CSSProperties = {
  position: "absolute",
  left: 26,
  right: 26,
  bottom: 22,
  padding: "18px 18px",
  borderRadius: 22,
  background: "linear-gradient(180deg, rgba(0,0,0,.62), rgba(0,0,0,.42))",
  border: "1px solid rgba(255,255,255,.12)",
  backdropFilter: "blur(10px)",
};

const qrCard: React.CSSProperties = {
  width: 260,
  padding: 14,
  borderRadius: 18,
  background: "rgba(0,0,0,.45)",
  border: "1px solid rgba(255,255,255,.12)",
};

const footer: React.CSSProperties = {
  height: 42,
  display: "flex",
  alignItems: "center",
  padding: "0 26px",
  borderTop: "1px solid rgba(255,255,255,.08)",
  background: "linear-gradient(0deg, rgba(8,10,14,.92), rgba(8,10,14,.62))",
};
