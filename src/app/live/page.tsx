"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { QRCodeCanvas } from "qrcode.react";
import TopBar from "@/components/TopBar";

type WallPhoto = {
  id: string;
  created_at: string;
  display_name: string | null;
  instagram: string | null;
  caption: string | null;
  storage_path: string;
  status: "pending" | "approved" | "rejected";
};

export default function LivePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";

  // Produção (Vercel/domínio): defina NEXT_PUBLIC_SUBMIT_URL=https://www.shihtzuz.com/submit
  const submitUrl =
    process.env.NEXT_PUBLIC_SUBMIT_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/submit` : "/submit");

  const [queue, setQueue] = useState<WallPhoto[]>([]);
  const [current, setCurrent] = useState<WallPhoto | null>(null);
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
      .limit(50);

    if (!error && data) {
      const arr = data as WallPhoto[];
      setQueue(arr);
      setCurrent(arr[0] || null);
    }
  }

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
            return next.slice(0, 80);
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

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => {
        if (!queue.length) return null;
        if (!c) return queue[0];
        const idx = queue.findIndex((x) => x.id === c.id);
        return queue[(idx + 1) % queue.length] || queue[0];
      });
    }, 7000);

    return () => timerRef.current && clearInterval(timerRef.current);
  }, [queue]);

  const [imgUrl, setImgUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!current) return setImgUrl("");
      setImgUrl(await getUrl(current.storage_path));
    })();
  }, [current?.id]);

  return (
    <div style={wrap}>
      {/* TOPBAR GLOBAL (logo + links) */}
      <TopBar />

      <div style={stage}>
        {/* IMAGEM */}
        {imgUrl ? (
          <img src={imgUrl} alt="Shih Tzu" style={img} />
        ) : (
          <div style={{ color: "var(--muted)" }}>Aguardando fotos aprovadas…</div>
        )}

        {/* LEGENDAS */}
        {current && (
          <div className="card" style={captionBox}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {current.display_name || "Seguidor"}
              {current.instagram ? (
                <span style={{ fontWeight: 600, opacity: 0.9 }}> • {current.instagram}</span>
              ) : null}
            </div>
            {current.caption ? <div style={{ opacity: 0.9 }}>{current.caption}</div> : null}
          </div>
        )}

        {/* QR + CTA */}
        <div className="card" style={qrBox}>
          <div className="title-font" style={{ fontSize: 14, opacity: 0.95, marginBottom: 8 }}>
            Envie a foto do seu Shih Tzu
          </div>

          <QRCodeCanvas value={submitUrl} size={170} includeMargin />

          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8, wordBreak: "break-all" }}>
            {submitUrl.replace("https://", "").replace("http://", "")}
          </div>
        </div>
      </div>

      <div style={footer}>
        <span style={{ opacity: 0.75 }}>OBS Browser Source • /live</span>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  display: "grid",
  gridTemplateRows: "64px 1fr 32px", // 64px = topbar global
};

const stage: React.CSSProperties = {
  position: "relative",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
};

const img: React.CSSProperties = {
  maxWidth: "96vw",
  maxHeight: "84vh",
  objectFit: "contain",
  borderRadius: 18,
  boxShadow: "0 24px 80px rgba(0,0,0,.55)",
};

const captionBox: React.CSSProperties = {
  position: "absolute",
  left: 16,
  right: 16,
  bottom: 16,
  padding: "12px 14px",
  borderRadius: 16,
  background: "rgba(0,0,0,.55)",
  border: "1px solid rgba(255,255,255,.12)",
  backdropFilter: "blur(6px)",
};

const qrBox: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 240,
  padding: 12,
  borderRadius: 16,
  background: "rgba(0,0,0,.55)",
  border: "1px solid rgba(255,255,255,.12)",
  backdropFilter: "blur(6px)",
  textAlign: "center",
};

const footer: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "0 16px",
  borderTop: "1px solid var(--line)",
  background: "rgba(15,23,35,.65)",
};
