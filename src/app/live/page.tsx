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
  storage_path: string;
  status: "pending" | "approved" | "rejected";
  // se você já tiver facebook/tiktok etc na tabela, adicione aqui depois
};

export default function LivePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";

  const submitUrl =
    process.env.NEXT_PUBLIC_SUBMIT_URL ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/submit`
      : "/submit");

  // duração das fotos (ms). default 10s
  const ROTATE_MS = Number(process.env.NEXT_PUBLIC_LIVE_ROTATE_MS || 10000);

  const [queue, setQueue] = useState<WallPhoto[]>([]);
  const [current, setCurrent] = useState<WallPhoto | null>(null);
  const [imgUrl, setImgUrl] = useState<string>("");

  const timerRef = useRef<any>(null);

  function getPublicUrl(path: string) {
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
      .channel("wall-photos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wall_photos" },
        (payload) => {
          const row = (payload.new || payload.old) as WallPhoto;
          if (!row) return;

          if (row.status === "approved") {
            setQueue((q) => {
              const exists = q.some((x) => x.id === row.id);
              const next = exists
                ? q.map((x) => (x.id === row.id ? row : x))
                : [row, ...q];
              return next.slice(0, 120);
            });
            setCurrent((c) => c || row);
          } else {
            setQueue((q) => q.filter((x) => x.id !== row.id));
          }
        }
      )
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
    }, ROTATE_MS);

    return () => timerRef.current && clearInterval(timerRef.current);
  }, [queue, ROTATE_MS]);

  useEffect(() => {
    if (!current) return setImgUrl("");
    setImgUrl(getPublicUrl(current.storage_path));
  }, [current?.id]);

  const name = current?.display_name || "Seguidor";
  const ig = current?.instagram ? `@${current.instagram.replace("@", "")}` : "";

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <img className="brandLogo" src="/brand/logo-badge.png" alt="ShihTzuz" />
          <div className="brandText">
            <div className="brandName">ShihTzuz</div>
            <div className="brandTag">Cuidados • Rotina • Diversão</div>
          </div>
        </div>

        <div className="topActions">
          <a className="btn" href="/submit">
            Enviar foto
          </a>
          <a className="livePill" href="/live" aria-label="Live">
            Live
          </a>
        </div>
      </header>

      <main className="stage">
        <div className="frame">
          {/* imagem */}
          {imgUrl ? (
            <img className="photo" src={imgUrl} alt="Foto de Shih Tzu" />
          ) : (
            <div className="empty">Aguardando fotos aprovadas…</div>
          )}

          {/* legenda (mobile: fixa embaixo, desktop: elegante) */}
          {current && (
            <div className="caption">
              <div className="captionLine1">
                <span className="captionName">{name}</span>
                {ig ? <span className="captionHandle"> • {ig}</span> : null}
              </div>
              {current.caption ? (
                <div className="captionLine2">{current.caption}</div>
              ) : null}
            </div>
          )}

          {/* QR (só desktop) */}
          <aside className="qr">
            <div className="qrTitle">Envie a foto do seu Shih Tzu</div>
            <div className="qrCode">
              <QRCodeCanvas value={submitUrl} size={170} includeMargin />
            </div>
            <div className="qrUrl">{submitUrl.replace("https://", "").replace("http://", "")}</div>
          </aside>
        </div>
      </main>

      <footer className="footer">
        <span>OBS Browser Source • /live</span>
        <span className="sep">•</span>
        <span>Troca: {(ROTATE_MS / 1000).toFixed(0)}s</span>
        <span className="sep">•</span>
        <span>Aprovados: {queue.length}</span>
      </footer>

      <style jsx>{`
        .wrap {
          width: 100vw;
          height: 100vh;
          display: grid;
          grid-template-rows: 64px 1fr 34px;
          background: radial-gradient(1200px 700px at 50% 0%, #101a28 0%, #070a0f 60%, #05070b 100%);
          color: #fff;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(5, 7, 11, 0.55);
          backdrop-filter: blur(10px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .brandLogo {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          flex: 0 0 auto;
        }
        .brandText {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .brandName {
          font-weight: 900;
          letter-spacing: 0.5px;
          font-size: 18px;
          line-height: 1;
        }
        .brandTag {
          font-size: 12px;
          opacity: 0.85;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .topActions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .btn {
          text-decoration: none;
          color: #0b0f14;
          background: linear-gradient(180deg, #f4d58a 0%, #d7b35f 100%);
          padding: 10px 12px;
          border-radius: 14px;
          font-weight: 900;
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .livePill {
          text-decoration: none;
          color: #fff;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.06);
          font-weight: 800;
        }

        .stage {
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 14px;
        }

        .frame {
          width: min(1200px, 100%);
          height: min(760px, 100%);
          position: relative;
          display: grid;
          place-items: center;
          border-radius: 22px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
          overflow: hidden;
        }

        .photo {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: rgba(0, 0, 0, 0.45);
        }

        .empty {
          color: rgba(255, 255, 255, 0.85);
          font-weight: 700;
        }

        .caption {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 14px;
          padding: 12px 14px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.70) 60%, rgba(0, 0, 0, 0.72) 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(6px);
        }
        .captionLine1 {
          font-size: 18px;
          font-weight: 900;
          line-height: 1.1;
        }
        .captionName {
          color: #ffffff;
        }
        .captionHandle {
          opacity: 0.9;
          font-weight: 800;
          color: #f4d58a;
        }
        .captionLine2 {
          margin-top: 6px;
          font-size: 14px;
          opacity: 0.92;
          line-height: 1.25;
        }

        .qr {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 260px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(8px);
          text-align: center;
        }
        .qrTitle {
          font-weight: 900;
          letter-spacing: 0.4px;
          margin-bottom: 10px;
          font-size: 13px;
          opacity: 0.95;
        }
        .qrCode {
          display: grid;
          place-items: center;
          background: #fff;
          border-radius: 14px;
          padding: 8px;
          margin: 0 auto;
          width: fit-content;
        }
        .qrUrl {
          margin-top: 10px;
          font-size: 12px;
          opacity: 0.9;
          word-break: break-word;
        }

        .footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 0 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(5, 7, 11, 0.55);
          backdrop-filter: blur(10px);
          font-size: 12px;
          opacity: 0.8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sep {
          opacity: 0.35;
        }

        /* ===== MOBILE ===== */
        @media (max-width: 820px) {
          .wrap {
            grid-template-rows: 58px 1fr 34px;
          }
          .btn {
            padding: 9px 10px;
            border-radius: 14px;
          }
          .frame {
            height: 100%;
            border-radius: 18px;
          }

          /* QR some no mobile */
          .qr {
            display: none;
          }

          /* legenda mais compacta */
          .caption {
            left: 10px;
            right: 10px;
            bottom: 10px;
            padding: 10px 12px;
            border-radius: 14px;
          }
          .captionLine1 {
            font-size: 16px;
          }
          .captionLine2 {
            font-size: 13px;
          }
        }

        /* ===== MUITO PEQUENO ===== */
        @media (max-width: 420px) {
          .brandName {
            font-size: 16px;
          }
          .brandTag {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
