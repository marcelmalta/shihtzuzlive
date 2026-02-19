"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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

function truncateText(value: string | null | undefined, maxChars: number) {
  if (!value) return "";
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}...`;
}

export default function LivePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";
  const submitUrl =
    process.env.NEXT_PUBLIC_SUBMIT_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/submit` : "/submit");
  const liveUrl = typeof window !== "undefined" ? `${window.location.origin}/live` : "/live";
  const ytLiveUrl = process.env.NEXT_PUBLIC_YOUTUBE_URL || "https://www.youtube.com/@ShihTZuz";

  const [queue, setQueue] = useState<WallPhoto[]>([]);
  const [current, setCurrent] = useState<WallPhoto | null>(null);
  const [imgUrl, setImgUrl] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const ownerName = current?.display_name?.trim() || "";
  const instagram = formatHandle(current?.instagram);
  const petName = current?.pet_name?.trim() || "Shih Tzu";
  const caption = truncateText(current?.caption, 50);
  const cityState = formatCityState(current?.city, current?.state);
  const petAge = formatPetAge(current?.pet_age);
  const showOwnerName = ownerName && ownerName.toLowerCase() !== petName.toLowerCase();
  const ownerCredit = [showOwnerName ? ownerName : "", instagram].filter(Boolean).join("  ");

  return (
    <main className="live-page">
      <div className="live-shell">
        <header className="live-topbar">
          <div className="brand">
            <Image
              src="/brand/logo-horizontal.png"
              alt="ShihTZuz"
              width={360}
              height={84}
              className="brand-logo"
              priority
            />
          </div>

          <div className="topbar-right">
            <span className="count-pill">Aprovados: {queue.length}</span>
            <span className="timer-pill">Troca automatica: {Math.round(SLIDE_MS / 1000)}s</span>
          </div>
        </header>

        <section className="live-stage">
          <div className="stage-main">
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
                      <div className="pet-main">
                        <span className="pet-title">{petName}</span>
                      </div>

                      <div className="meta-chips">
                        {cityState ? <span className="meta-chip">{cityState}</span> : null}
                        {petAge ? <span className="meta-chip">{petAge}</span> : null}
                      </div>
                    </div>

                    {(caption || ownerCredit) && (
                      <div className="overlay-line-2">
                        {caption ? <span className="caption">{caption}</span> : null}
                        {ownerCredit ? <span className="owner-credit">{ownerCredit}</span> : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <p className="stage-note">
              Envie a foto do seu Shih Tzu em <b>/submit</b> e assista o mural em <b>/live</b> (OBS).
            </p>
          </div>

          <aside className="live-side">
            <div className="action-grid">
              <a href="/submit" className="action-btn gold">
                Enviar foto
              </a>
              <a href={liveUrl} className="action-btn ghost">
                Abrir /live (OBS)
              </a>
              <a href={ytLiveUrl} target="_blank" rel="noreferrer" className="action-btn youtube">
                Assistir Live (YouTube)
              </a>
            </div>

            <div className="live-qr">
              <div className="qr-title">Envie a foto do seu Shih Tzu</div>
              <div className="qr-canvas-box">
                <QRCodeCanvas value={submitUrl} size={148} includeMargin bgColor="#ffffff" fgColor="#000000" />
              </div>
              <div className="qr-url">{submitUrl.replace(/^https?:\/\//, "")}</div>
            </div>
          </aside>
        </section>

        <footer className="live-footer">
          <span>OBS Browser Source: /live</span>
          <span>Troca automatica: {Math.round(SLIDE_MS / 1000)}s</span>
        </footer>
      </div>

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
          min-height: 100%;
          background: #000;
        }

        .live-page {
          width: 100%;
          min-height: 100dvh;
          padding: clamp(8px, 1.5vw, 18px);
          color: var(--text-main);
          display: flex;
          align-items: stretch;
          justify-content: center;
          background:
            radial-gradient(90% 90% at 10% 0%, rgba(245, 211, 122, 0.12) 0%, rgba(0, 0, 0, 0) 55%),
            radial-gradient(90% 90% at 100% 0%, rgba(197, 141, 47, 0.1) 0%, rgba(0, 0, 0, 0) 52%),
            linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        }

        .live-shell {
          width: min(1500px, 100%);
          min-height: calc(100dvh - clamp(16px, 3vw, 36px));
          display: grid;
          grid-template-rows: auto 1fr auto;
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(245, 211, 122, 0.2);
          background:
            linear-gradient(180deg, rgba(8, 8, 8, 0.96), rgba(4, 4, 4, 0.95)),
            radial-gradient(120% 120% at 50% -20%, rgba(245, 211, 122, 0.1), rgba(0, 0, 0, 0));
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.6);
        }

        .live-topbar {
          min-height: 74px;
          padding: 10px clamp(10px, 1.4vw, 18px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.34));
          border-bottom: 1px solid rgba(245, 211, 122, 0.2);
          backdrop-filter: blur(8px);
          z-index: 4;
        }

        .brand {
          min-width: 0;
          display: flex;
          align-items: center;
          width: clamp(200px, 28vw, 360px);
          height: clamp(44px, 6.2vh, 64px);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(245, 211, 122, 0.24);
          background: rgba(0, 0, 0, 0.42);
        }

        .brand-logo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 44%;
          display: block;
          filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.45));
        }

        .topbar-right {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .count-pill,
        .timer-pill {
          font-size: clamp(11px, 0.95vw, 14px);
          padding: 7px 11px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(0, 0, 0, 0.42);
          backdrop-filter: blur(6px);
          white-space: nowrap;
        }

        .timer-pill {
          color: rgba(255, 233, 188, 0.9);
        }

        .live-stage {
          min-height: 0;
          padding: clamp(10px, 1.3vw, 18px);
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(240px, 300px);
          gap: clamp(10px, 1.2vw, 16px);
          align-items: start;
        }

        .stage-main {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .frame-shell {
          width: 100%;
          aspect-ratio: 16 / 9;
          max-height: min(72vh, 780px);
          min-height: 250px;
          border-radius: 28px;
          padding: 4px;
          background: linear-gradient(
            140deg,
            rgba(245, 211, 122, 0.95) 0%,
            rgba(236, 198, 109, 0.52) 25%,
            rgba(170, 115, 43, 0.32) 46%,
            rgba(245, 211, 122, 0.8) 70%,
            rgba(197, 141, 47, 0.92) 100%
          );
          box-shadow:
            0 30px 74px rgba(0, 0, 0, 0.58),
            0 0 0 1px rgba(255, 244, 214, 0.18) inset;
          position: relative;
        }

        .frame-image-wrap {
          width: 100%;
          height: 100%;
          border-radius: 24px;
          background:
            linear-gradient(180deg, rgba(12, 12, 12, 0.95), rgba(4, 4, 4, 0.92)),
            radial-gradient(100% 100% at 50% 0%, rgba(245, 211, 122, 0.08), rgba(0, 0, 0, 0));
          border: 1px solid rgba(255, 233, 173, 0.16);
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
          font-size: clamp(16px, 1.9vw, 26px);
          font-weight: 600;
          color: rgba(255, 245, 225, 0.86);
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(245, 211, 122, 0.22);
        }

        .photo-overlay {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 12px;
          padding: 12px 15px;
          border-radius: 14px;
          background: var(--glass);
          border: 1px solid rgba(245, 211, 122, 0.32);
          backdrop-filter: blur(10px);
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.56);
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

        .pet-main {
          min-width: 0;
        }

        .pet-title {
          font-size: clamp(20px, 2.45vw, 34px);
          font-weight: 900;
          letter-spacing: 0.02em;
          line-height: 1.04;
          color: #ffe5a4;
        }

        .meta-chips {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
          min-width: 0;
        }

        .meta-chip {
          font-size: clamp(12px, 1vw, 16px);
          font-weight: 700;
          line-height: 1;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(245, 211, 122, 0.58);
          color: #fff2d0;
          background: rgba(0, 0, 0, 0.5);
        }

        .overlay-line-2 {
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-width: 0;
        }

        .caption {
          flex: 1 1 auto;
          min-width: 0;
          font-size: clamp(14px, 1.2vw, 20px);
          font-weight: 700;
          line-height: 1.2;
          color: #fff6e0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .owner-credit {
          flex: 0 0 auto;
          max-width: 40%;
          font-size: clamp(11px, 0.92vw, 15px);
          font-weight: 600;
          letter-spacing: 0.01em;
          color: rgba(255, 236, 194, 0.88);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stage-note {
          margin: 0;
          font-size: clamp(12px, 0.96vw, 15px);
          color: rgba(255, 237, 198, 0.88);
        }

        .stage-note b {
          color: #ffe1a0;
        }

        .live-side {
          min-width: 0;
          display: grid;
          align-content: start;
          gap: 10px;
        }

        .action-grid {
          display: grid;
          gap: 8px;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 8px 14px;
          border-radius: 13px;
          text-decoration: none;
          font-weight: 900;
          font-size: 14px;
          border: 1px solid transparent;
          text-align: center;
          transition: filter 120ms ease, transform 120ms ease;
        }

        .action-btn:hover {
          filter: brightness(1.05);
          transform: translateY(-1px);
        }

        .action-btn.gold {
          color: #151007;
          border-color: rgba(255, 245, 220, 0.55);
          background: linear-gradient(135deg, var(--gold-1), var(--gold-2));
          box-shadow: 0 12px 28px rgba(197, 141, 47, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }

        .action-btn.ghost {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
        }

        .action-btn.youtube {
          color: #ffffff;
          border-color: rgba(255, 45, 45, 0.4);
          background: rgba(255, 45, 45, 0.16);
        }

        .live-qr {
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(245, 211, 122, 0.3);
          backdrop-filter: blur(8px);
          text-align: center;
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5);
          padding: 11px;
        }

        .qr-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
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
          min-height: 38px;
          padding: 0 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
          border-top: 1px solid rgba(245, 211, 122, 0.16);
          color: rgba(255, 236, 196, 0.86);
          background: rgba(0, 0, 0, 0.56);
        }

        @media (max-width: 1180px) {
          .live-stage {
            grid-template-columns: minmax(0, 1fr) minmax(220px, 270px);
          }

          .frame-shell {
            max-height: min(66vh, 700px);
          }
        }

        @media (max-width: 980px) {
          .live-shell {
            border-radius: 20px;
          }

          .live-topbar {
            min-height: 68px;
            padding-inline: 10px;
          }

          .brand {
            width: clamp(160px, 52vw, 290px);
            height: clamp(40px, 6vh, 54px);
          }

          .live-stage {
            grid-template-columns: 1fr;
          }

          .frame-shell {
            aspect-ratio: 16 / 10;
            max-height: min(56vh, 540px);
            min-height: 230px;
            border-radius: 22px;
          }

          .frame-image-wrap {
            border-radius: 18px;
          }

          .live-side {
            grid-template-columns: minmax(0, 1fr) 220px;
            align-items: start;
          }
        }

        @media (max-width: 760px) {
          .live-page {
            padding: 8px;
          }

          .live-shell {
            min-height: calc(100dvh - 16px);
          }

          .timer-pill {
            display: none;
          }

          .frame-shell {
            aspect-ratio: 4 / 3;
            max-height: min(48vh, 430px);
            min-height: 210px;
          }

          .photo-overlay {
            left: 8px;
            right: 8px;
            bottom: 8px;
            padding: 10px 11px;
          }

          .overlay-line-1 {
            flex-direction: column;
            align-items: flex-start;
            gap: 7px;
          }

          .pet-title {
            font-size: clamp(18px, 6vw, 28px);
          }

          .meta-chips {
            justify-content: flex-start;
          }

          .overlay-line-2 {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
          }

          .caption {
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .owner-credit {
            max-width: 100%;
          }

          .live-side {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .count-pill {
            display: none;
          }

          .live-topbar {
            min-height: 62px;
          }

          .action-btn {
            min-height: 40px;
            font-size: 13px;
          }

          .live-footer {
            min-height: auto;
            padding: 6px 10px;
            font-size: 10px;
          }
        }
      `}</style>
    </main>
  );
}
