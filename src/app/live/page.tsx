"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { QRCodeCanvas } from "qrcode.react";

type WallPhoto = {
  id: string;
  created_at: string;
  display_name: string | null;
  instagram: string | null;
  caption: string | null;
  city: string | null;
  state: string | null;
  pet_age: string | null;
  storage_path: string;
  status: "pending" | "approved" | "rejected";
};

export default function LivePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";

  // URL pública do submit (domínio/Vercel). Se não setar, usa /submit do mesmo host.
  const submitUrl =
    process.env.NEXT_PUBLIC_SUBMIT_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/submit` : "/submit");

  // duração de cada foto (ms) — pode ajustar por env ou aqui
  const SLIDE_MS = Number(process.env.NEXT_PUBLIC_SLIDE_MS || 7000);

  const [queue, setQueue] = useState<WallPhoto[]>([]);
  const [current, setCurrent] = useState<WallPhoto | null>(null);
  const [imgUrl, setImgUrl] = useState<string>("");

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

  // realtime
  useEffect(() => {
    loadApproved();

    const ch = supabase
      .channel("wall-photos")
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

  // slideshow
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCurrent((c) => {
        if (!queue.length) return null;
        if (!c) return queue[0];
        const idx = queue.findIndex((x) => x.id === c.id);
        return queue[(idx + 1) % queue.length] || queue[0];
      });
    }, SLIDE_MS);

    return () => timerRef.current && clearInterval(timerRef.current);
  }, [queue, SLIDE_MS]);

  // load image url
  useEffect(() => {
    (async () => {
      if (!current) return setImgUrl("");
      setImgUrl(await getUrl(current.storage_path));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const metaLine = buildMetaLine(current);

  return (
    <div style={wrap}>
      {/* TOPBAR */}
      <div style={topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandDot} />
          <div>
            <div style={{ fontWeight: 900, letterSpacing: 0.6 }}>SHIHTZUZ • LIVE WALL</div>
            <div style={{ fontSize: 13, opacity: 0.78 }}>Cuidados • Rotina • Diversão</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/submit" style={ctaBtn}>
            Enviar foto
          </a>
          <div style={pill}>Aprovados: {queue.length}</div>
        </div>
      </div>

      {/* STAGE */}
      <div style={stage}>
        {/* IMAGEM */}
        {imgUrl ? (
          <img src={imgUrl} alt="Shih Tzu" style={img} />
        ) : (
          <div style={{ color: "#cfd7e6" }}>Aguardando fotos aprovadas…</div>
        )}

        {/* CAPTION (centralizada e elegante) */}
        {current && (
          <div style={captionWrap}>
            <div style={captionCard}>
              <div style={capTopRow}>
                <div style={capName}>{current.display_name || "Seguidor"}</div>

                {current.instagram ? (
                  <div style={capHandle}>
                    {current.instagram.startsWith("@") ? current.instagram : `@${current.instagram}`}
                  </div>
                ) : null}
              </div>

              {metaLine ? <div style={capMeta}>{metaLine}</div> : null}

              {current.caption ? <div style={capText}>{current.caption}</div> : null}
            </div>
          </div>
        )}

        {/* QR (desktop/tablet somente) */}
        <div style={qrWrap} className="qrOnly">
          <div style={qrTitle}>Envie a foto do seu Shih Tzu</div>

          {/* QR mais nítido: fundo branco + margem + tamanho maior */}
          <div style={qrCanvasFrame}>
            <QRCodeCanvas value={submitUrl} size={200} includeMargin bgColor="#ffffff" fgColor="#000000" />
          </div>

          <div style={qrUrl}>{submitUrl.replace(/^https?:\/\//, "")}</div>
          <div style={qrHint}>Aponte a câmera • abre o formulário</div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={footer}>
        <span style={{ opacity: 0.75 }}>OBS Browser Source • /live</span>
        <span style={{ opacity: 0.75 }}>Troca automática: {Math.round(SLIDE_MS / 1000)}s</span>
      </div>

      {/* CSS rápido p/ esconder QR no mobile */}
      <style jsx global>{`
        @media (max-width: 820px) {
          .qrOnly {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function buildMetaLine(current: WallPhoto | null) {
  if (!current) return "";
  const parts: string[] = [];

  const cityState = [current.city, current.state].filter(Boolean).join(" • ");
  if (cityState) parts.push(cityState);

  if (current.pet_age) parts.push(`Idade do pet: ${current.pet_age}`);

  return parts.join("  |  ");
}

// ===== styles =====

const wrap: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  background: "radial-gradient(1200px 700px at 20% 10%, rgba(255, 209, 102, 0.10), transparent 55%), #0b0f14",
  color: "#fff",
  display: "grid",
  gridTemplateRows: "64px 1fr 36px",
};

const topBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 16px",
  background: "linear-gradient(180deg, rgba(18,28,40,.92), rgba(10,15,22,.86))",
  borderBottom: "1px solid rgba(255,255,255,.10)",
  backdropFilter: "blur(10px)",
};

const brandDot: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  background: "linear-gradient(180deg, #f5d37a, #b9852d)",
  boxShadow: "0 10px 28px rgba(0,0,0,.35)",
  border: "1px solid rgba(255,255,255,.18)",
};

const ctaBtn: React.CSSProperties = {
  color: "#0b0f14",
  background: "linear-gradient(180deg, #f5d37a, #c58d2f)",
  padding: "10px 14px",
  borderRadius: 14,
  textDecoration: "none",
  fontWeight: 900,
  letterSpacing: 0.4,
  boxShadow: "0 14px 34px rgba(0,0,0,.35)",
  border: "1px solid rgba(255,255,255,.18)",
};

const pill: React.CSSProperties = {
  fontSize: 13,
  padding: "8px 10px",
  borderRadius: 999,
  background: "rgba(0,0,0,.35)",
  border: "1px solid rgba(255,255,255,.12)",
  backdropFilter: "blur(8px)",
};

const stage: React.CSSProperties = {
  position: "relative",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  padding: 18,
};

const img: React.CSSProperties = {
  width: "min(92vw, 1180px)",
  height: "min(78vh, 620px)",
  objectFit: "cover",
  borderRadius: 22,
  boxShadow: "0 34px 120px rgba(0,0,0,.62)",
  border: "1px solid rgba(255,255,255,.10)",
};

const captionWrap: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 16,
  display: "grid",
  placeItems: "center",
  padding: "0 16px",
};

const captionCard: React.CSSProperties = {
  width: "min(1060px, 92vw)",
  padding: "14px 16px",
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.42))",
  border: "1px solid rgba(255,255,255,.14)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 18px 60px rgba(0,0,0,.45)",
};

const capTopRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const capName: React.CSSProperties = {
  fontWeight: 1000,
  fontSize: 20,
  letterSpacing: 0.2,
};

const capHandle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  opacity: 0.9,
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(255, 209, 102, 0.14)",
  border: "1px solid rgba(255, 209, 102, 0.28)",
};

const capMeta: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  opacity: 0.82,
};

const capText: React.CSSProperties = {
  marginTop: 8,
  fontSize: 16,
  opacity: 0.95,
  lineHeight: 1.25,
};

const qrWrap: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 270,
  padding: 14,
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.40))",
  border: "1px solid rgba(255,255,255,.14)",
  backdropFilter: "blur(10px)",
  textAlign: "center",
  boxShadow: "0 18px 60px rgba(0,0,0,.45)",
};

const qrTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: 0.5,
  marginBottom: 10,
};

const qrCanvasFrame: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 14,
  padding: 10,
  display: "inline-block",
  boxShadow: "0 10px 28px rgba(0,0,0,.35)",
};

const qrUrl: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12.5,
  opacity: 0.9,
  fontWeight: 800,
};

const qrHint: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.75,
};

const footer: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  borderTop: "1px solid rgba(255,255,255,.10)",
  background: "rgba(15, 23, 35, .85)",
  backdropFilter: "blur(10px)",
};
