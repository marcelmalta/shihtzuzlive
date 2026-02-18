"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { QRCodeCanvas } from "qrcode.react";

type WallPhoto = {
  id: string;
  created_at: string;
  display_name: string | null;
  instagram: string | null;
  caption: string | null;
  pet_name: string | null;
  pet_age: string | number | null;
  city: string | null;
  state: string | null;
  storage_path: string | null;
  status: "pending" | "approved" | "rejected";
};

const DEFAULT_SLIDE_MS = 7000;
const ENV_SLIDE_MS = Number(process.env.NEXT_PUBLIC_SLIDE_MS);
const SLIDE_MS =
  Number.isFinite(ENV_SLIDE_MS) && ENV_SLIDE_MS > 0 ? ENV_SLIDE_MS : DEFAULT_SLIDE_MS;

function formatHandle(instagram: string | null | undefined) {
  if (!instagram) return "";
  const trimmed = instagram.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function formatCityState(city?: string | null, state?: string | null) {
  const c = city?.trim() ?? "";
  const s = state?.trim() ?? "";
  if (c && s) return `${c}/${s}`;
  return c || s;
}

function formatPetAge(age: string | number | null | undefined) {
  if (age === null || age === undefined) return "";
  const text = String(age).trim();
  return text ? `Idade: ${text}` : "";
}

export default function LivePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";
  const submitUrl =
    process.env.NEXT_PUBLIC_SUBMIT_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/submit` : "/submit");

  const [queue, setQueue] = useState<WallPhoto[]>([]);
  const [current, setCurrent] = useState<WallPhoto | null>(null);
  const [imgUrl, setImgUrl] = useState("");
  const [isDesktopQr, setIsDesktopQr] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const syncViewport = () => setIsDesktopQr(window.innerWidth > 820);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  async function getPublicUrl(path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  const loadApproved = useCallback(async () => {
    const { data, error } = await supabase
      .from("wall_photos")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(120);

    if (error || !data) return;

    const approved = data as WallPhoto[];
    setQueue(approved);
    setCurrent((prev) => prev ?? approved[0] ?? null);
  }, [supabase]);

  useEffect(() => {
    loadApproved();

    const channel = supabase
      .channel("wall-photos")
      .on("postgres_changes", { event: "*", schema: "public", table: "wall_photos" }, (payload) => {
        const row = (payload.new || payload.old) as WallPhoto | null;
        if (!row?.id) return;

        if (row.status === "approved") {
          setQueue((prev) => {
            const exists = prev.some((item) => item.id === row.id);
            const next = exists ? prev.map((item) => (item.id === row.id ? row : item)) : [row, ...prev];
            return next.slice(0, 120);
          });
          setCurrent((prev) => prev ?? row);
          return;
        }

        setQueue((prev) => prev.filter((item) => item.id !== row.id));
        setCurrent((prev) => (prev?.id === row.id ? null : prev));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadApproved, supabase]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCurrent((prev) => {
        if (!queue.length) return null;
        if (!prev) return queue[0];
        const idx = queue.findIndex((item) => item.id === prev.id);
        return queue[(idx + 1) % queue.length] || queue[0];
      });
    }, SLIDE_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [queue]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!current?.storage_path) {
        if (active) setImgUrl("");
        return;
      }

      const url = await getPublicUrl(current.storage_path);
      if (active) setImgUrl(url);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const ownerName = current?.display_name?.trim() || "Tutor(a)";
  const instagram = formatHandle(current?.instagram);
  const petName = current?.pet_name?.trim() || "";
  const caption = current?.caption?.trim() || "";
  const cityState = formatCityState(current?.city, current?.state);
  const petAge = formatPetAge(current?.pet_age);
  const badge = [cityState, petAge].filter(Boolean).join("  •  ");

  return (
    <main className="live-page">
      <header className="live-topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div className="brand-copy">
            <strong>SHIHTZUZ LIVE WALL</strong>
            <small>Cuidados | Rotina | Diversao</small>
          </div>
        </div>

        <div className="topbar-right">
          <a href="/submit" className="submit-btn">
            Enviar foto
          </a>
          <span className="count-pill">Aprovados: {queue.length}</span>
        </div>
      </header>

      <section className="live-stage">
        <div className="frame-shell">
          <div className="frame-image-wrap">
            {imgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl} alt="Foto enviada para o mural ShihTzuz" className="frame-image" />
            ) : (
              <div className="empty-state">Aguardando fotos aprovadas...</div>
            )}

            {current && (
              <div className="photo-overlay">
                <div className="overlay-line-1">
                  <div className="owner-group">
                    <span className="owner-name">{ownerName}</span>
                    {instagram ? <span className="owner-instagram">{instagram}</span> : null}
                  </div>
                  {badge ? <span className="meta-badge">{badge}</span> : null}
                </div>

                {(petName || caption) && (
                  <div className="overlay-line-2">
                    {petName ? <span className="pet-name">{petName}</span> : null}
                    {caption ? <span className="caption">{caption}</span> : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isDesktopQr && (
          <aside className="live-qr qrOnly">
            <div className="qr-title">Envie a foto do seu Shih Tzu</div>
            <div className="qr-canvas-box">
              <QRCodeCanvas value={submitUrl} size={156} includeMargin bgColor="#ffffff" fgColor="#000000" />
            </div>
            <div className="qr-url">{submitUrl.replace(/^https?:\/\//, "")}</div>
          </aside>
        )}
      </section>

      <footer className="live-footer">
        <span>OBS Browser Source: /live</span>
        <span>Troca automatica: {Math.round(SLIDE_MS / 1000)}s</span>
      </footer>

      <style jsx global>{`
        :root {
          --gold-1: #f5d37a;
          --gold-2: #c58d2f;
          --bg-1: #090909;
          --bg-2: #111111;
          --glass: rgba(0, 0, 0, 0.55);
          --text-main: #fff7e6;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          width: 100%;
          height: 100%;
          background: #000;
        }

        .live-page {
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          color: var(--text-main);
          display: grid;
          grid-template-rows: 76px 1fr 42px;
          background:
            radial-gradient(80% 120% at 8% -5%, rgba(245, 211, 122, 0.12) 0%, rgba(0, 0, 0, 0) 55%),
            radial-gradient(80% 120% at 100% 0%, rgba(197, 141, 47, 0.08) 0%, rgba(0, 0, 0, 0) 50%),
            linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        }

        .live-topbar {
          padding: 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.35));
          border-bottom: 1px solid rgba(245, 211, 122, 0.22);
          backdrop-filter: blur(8px);
          z-index: 4;
        }

        .brand {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-mark {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          flex: 0 0 auto;
          background: linear-gradient(135deg, var(--gold-1), var(--gold-2));
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.28);
        }

        .brand-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          line-height: 1.05;
          gap: 4px;
        }

        .brand-copy strong {
          font-size: clamp(14px, 2vw, 21px);
          letter-spacing: 0.06em;
          color: #ffe8b0;
          white-space: nowrap;
        }

        .brand-copy small {
          font-size: clamp(11px, 1.1vw, 14px);
          opacity: 0.82;
          white-space: nowrap;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 0 0 auto;
        }

        .submit-btn {
          text-decoration: none;
          color: #151007;
          font-weight: 900;
          font-size: clamp(13px, 1.1vw, 16px);
          letter-spacing: 0.03em;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255, 245, 220, 0.56);
          background: linear-gradient(135deg, var(--gold-1), var(--gold-2));
          box-shadow: 0 14px 32px rgba(197, 141, 47, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.45);
          transition: filter 120ms ease, transform 120ms ease;
        }

        .submit-btn:hover {
          filter: brightness(1.06);
          transform: translateY(-1px);
        }

        .count-pill {
          font-size: clamp(12px, 1vw, 14px);
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(6px);
          white-space: nowrap;
        }

        .live-stage {
          position: relative;
          min-height: 0;
          display: grid;
          place-items: center;
          padding: 16px 18px 14px;
          overflow: hidden;
        }

        .frame-shell {
          width: min(95vw, 1660px);
          height: min(84vh, 900px);
          min-height: 280px;
          border-radius: 30px;
          padding: 4px;
          background: linear-gradient(
            140deg,
            rgba(245, 211, 122, 0.95) 0%,
            rgba(236, 198, 109, 0.5) 22%,
            rgba(170, 115, 43, 0.28) 44%,
            rgba(245, 211, 122, 0.82) 66%,
            rgba(197, 141, 47, 0.9) 100%
          );
          box-shadow:
            0 40px 90px rgba(0, 0, 0, 0.7),
            0 0 0 1px rgba(255, 244, 214, 0.18) inset;
          position: relative;
        }

        .frame-image-wrap {
          width: 100%;
          height: 100%;
          border-radius: 26px;
          background:
            linear-gradient(180deg, rgba(13, 13, 13, 0.95), rgba(4, 4, 4, 0.92)),
            radial-gradient(100% 100% at 50% 0%, rgba(245, 211, 122, 0.08), rgba(0, 0, 0, 0));
          border: 1px solid rgba(255, 233, 173, 0.18);
          overflow: hidden;
          position: relative;
          display: grid;
          place-items: center;
        }

        .frame-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #050505;
        }

        .empty-state {
          padding: 14px 20px;
          border-radius: 12px;
          font-size: clamp(18px, 2.2vw, 28px);
          font-weight: 600;
          color: rgba(255, 245, 225, 0.85);
          background: rgba(0, 0, 0, 0.48);
          border: 1px solid rgba(245, 211, 122, 0.22);
        }

        .photo-overlay {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 14px;
          padding: 14px 18px;
          border-radius: 16px;
          background: var(--glass);
          border: 1px solid rgba(245, 211, 122, 0.34);
          backdrop-filter: blur(10px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.58);
          color: #fff9ed;
          text-shadow: 0 2px 5px rgba(0, 0, 0, 0.65);
        }

        .overlay-line-1 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
        }

        .owner-group {
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }

        .owner-name {
          font-size: clamp(20px, 2.3vw, 34px);
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0.015em;
        }

        .owner-instagram {
          font-size: clamp(15px, 1.4vw, 23px);
          font-weight: 800;
          color: #ffe2a5;
          line-height: 1.05;
        }

        .meta-badge {
          flex: 0 0 auto;
          max-width: min(52vw, 520px);
          text-align: right;
          font-size: clamp(14px, 1.25vw, 20px);
          font-weight: 700;
          line-height: 1.1;
          padding: 7px 11px;
          border-radius: 999px;
          border: 1px solid rgba(245, 211, 122, 0.5);
          background: rgba(0, 0, 0, 0.42);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .overlay-line-2 {
          margin-top: 9px;
          display: flex;
          align-items: baseline;
          gap: 10px;
          min-width: 0;
        }

        .pet-name {
          flex: 0 0 auto;
          font-size: clamp(18px, 1.8vw, 30px);
          font-weight: 900;
          color: #ffd988;
          line-height: 1.1;
        }

        .caption {
          min-width: 0;
          font-size: clamp(15px, 1.45vw, 24px);
          font-weight: 600;
          line-height: 1.22;
          color: #fff6e0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .live-qr {
          position: absolute;
          top: 18px;
          right: 18px;
          width: 220px;
          padding: 12px 12px 11px;
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(245, 211, 122, 0.3);
          backdrop-filter: blur(8px);
          text-align: center;
          box-shadow: 0 16px 44px rgba(0, 0, 0, 0.52);
        }

        .qr-title {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.03em;
          margin-bottom: 8px;
          color: #ffe7af;
        }

        .qr-canvas-box {
          display: inline-flex;
          border-radius: 12px;
          padding: 8px;
          background: #fff;
        }

        .qr-url {
          margin-top: 8px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 245, 223, 0.86);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .live-footer {
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
          border-top: 1px solid rgba(245, 211, 122, 0.16);
          color: rgba(255, 236, 196, 0.86);
          background: rgba(0, 0, 0, 0.55);
        }

        @media (max-width: 1280px) {
          .frame-shell {
            height: min(82vh, 820px);
          }

          .live-qr {
            width: 198px;
          }

          .meta-badge {
            max-width: 48vw;
          }
        }

        @media (max-width: 1024px) {
          .live-page {
            grid-template-rows: 72px 1fr 38px;
          }

          .frame-shell {
            width: min(96vw, 1300px);
            height: min(82vh, 760px);
            border-radius: 24px;
          }

          .frame-image-wrap {
            border-radius: 20px;
          }

          .photo-overlay {
            left: 10px;
            right: 10px;
            bottom: 10px;
            padding: 12px 14px;
          }
        }

        @media (max-width: 820px) {
          .qrOnly,
          .live-qr {
            display: none !important;
          }

          .live-page {
            grid-template-rows: 68px 1fr 34px;
          }

          .live-topbar {
            padding: 0 10px;
            gap: 8px;
          }

          .brand-mark {
            width: 30px;
            height: 30px;
            border-radius: 10px;
          }

          .brand-copy strong {
            letter-spacing: 0.04em;
            font-size: clamp(12px, 4vw, 18px);
          }

          .brand-copy small {
            display: none;
          }

          .topbar-right {
            gap: 6px;
          }

          .submit-btn {
            padding: 9px 12px;
            font-size: 13px;
          }

          .count-pill {
            font-size: 11px;
            padding: 7px 9px;
          }

          .live-stage {
            padding: 10px 10px 8px;
          }

          .frame-shell {
            width: 100%;
            height: 100%;
            max-height: 100%;
            border-radius: 20px;
            padding: 3px;
          }

          .frame-image-wrap {
            border-radius: 17px;
          }

          .frame-image {
            object-fit: cover;
          }

          .photo-overlay {
            left: 8px;
            right: 8px;
            bottom: 8px;
            border-radius: 14px;
            padding: 10px 12px;
          }

          .overlay-line-1 {
            gap: 8px;
          }

          .owner-group {
            gap: 7px;
          }

          .meta-badge {
            font-size: 12px;
            max-width: 46%;
            padding: 5px 8px;
          }

          .overlay-line-2 {
            margin-top: 7px;
            gap: 7px;
          }

          .caption {
            -webkit-line-clamp: 3;
          }

          .live-footer {
            padding: 0 10px;
            font-size: 10px;
          }
        }

        @media (max-width: 540px) {
          .count-pill {
            display: none;
          }

          .live-page {
            grid-template-rows: 64px 1fr 30px;
          }

          .overlay-line-1 {
            align-items: flex-start;
            flex-direction: column;
          }

          .meta-badge {
            max-width: 100%;
            width: fit-content;
            text-align: left;
          }

          .overlay-line-2 {
            flex-direction: column;
            align-items: flex-start;
          }

          .caption {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
