"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type FitMode = "contain" | "cover";

type FrameOptions = {
  fitMode: FitMode;
  zoom: number;
  offsetX: number;
  offsetY: number;
  outputW: number;
  outputH: number;
};

const DEFAULT_MAX_MB = 3;
const DEFAULT_MAX_W = 1920;
const DEFAULT_OUTPUT_W = 1920;
const DEFAULT_OUTPUT_H = 1080;
const MAX_CAPTION_CHARS = 50;

function toPositiveNumber(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function replaceExt(filename: string, newExt: string) {
  const base = filename.replace(/\.[^/.]+$/, "") || "foto";
  return `${base}.${newExt}`;
}

function cleanHandle(s: string) {
  return s.trim().replace(/^@+/, "");
}

async function loadImageFromFile(file: Blob) {
  const url = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Nao foi possivel gerar a imagem final."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function renderForLiveFrame(file: File, options: FrameOptions) {
  const image = await loadImageFromFile(file);
  const sourceW = image.naturalWidth || image.width;
  const sourceH = image.naturalHeight || image.height;

  if (!sourceW || !sourceH) {
    throw new Error("Imagem invalida.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(options.outputW);
  canvas.height = Math.round(options.outputH);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nao foi possivel processar a imagem.");

  const frameW = canvas.width;
  const frameH = canvas.height;

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, frameW, frameH);

  if (options.fitMode === "contain") {
    const bgScale = Math.max(frameW / sourceW, frameH / sourceH);
    const bgW = sourceW * bgScale;
    const bgH = sourceH * bgScale;
    const bgX = (frameW - bgW) * 0.5;
    const bgY = (frameH - bgH) * 0.5;

    ctx.save();
    ctx.filter = "blur(36px) brightness(0.45)";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(image, bgX, bgY, bgW, bgH);
    ctx.restore();

    const vignette = ctx.createLinearGradient(0, 0, 0, frameH);
    vignette.addColorStop(0, "rgba(0,0,0,0.20)");
    vignette.addColorStop(0.5, "rgba(0,0,0,0.06)");
    vignette.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, frameW, frameH);
  }

  const fitScale =
    options.fitMode === "cover"
      ? Math.max(frameW / sourceW, frameH / sourceH)
      : Math.min(frameW / sourceW, frameH / sourceH);

  const finalScale = fitScale * clamp(options.zoom, 1, 2.5);
  const drawW = sourceW * finalScale;
  const drawH = sourceH * finalScale;

  const positionX = clamp(options.offsetX, 0, 100) / 100;
  const positionY = clamp(options.offsetY, 0, 100) / 100;
  const drawX = (frameW - drawW) * positionX;
  const drawY = (frameH - drawH) * positionY;

  ctx.drawImage(image, drawX, drawY, drawW, drawH);

  const blob = await canvasToBlob(canvas, 0.9);

  return new File([blob], replaceExt(file.name, "jpg"), {
    type: "image/jpeg",
  });
}

export default function SubmitPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";
  const MAX_MB = toPositiveNumber(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB, DEFAULT_MAX_MB);
  const MAX_W = toPositiveNumber(process.env.NEXT_PUBLIC_UPLOAD_MAX_W, DEFAULT_MAX_W);
  const OUTPUT_W = toPositiveNumber(process.env.NEXT_PUBLIC_UPLOAD_OUTPUT_W, DEFAULT_OUTPUT_W);
  const OUTPUT_H = toPositiveNumber(process.env.NEXT_PUBLIC_UPLOAD_OUTPUT_H, DEFAULT_OUTPUT_H);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [petName, setPetName] = useState("");
  const [petAge, setPetAge] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [caption, setCaption] = useState("");

  const [fitMode, setFitMode] = useState<FitMode>("contain");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(50);
  const [offsetY, setOffsetY] = useState(50);

  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const previewUrlRef = useRef<string | null>(null);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview("");
  }, []);

  useEffect(() => {
    return () => clearPreview();
  }, [clearPreview]);

  async function onPick(selected?: File | null) {
    setOkMsg("");
    setErrMsg("");

    if (!selected) {
      setFile(null);
      clearPreview();
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setErrMsg("Escolha uma imagem (JPG/PNG/WebP).");
      return;
    }

    clearPreview();

    const objectUrl = URL.createObjectURL(selected);
    previewUrlRef.current = objectUrl;

    setFile(selected);
    setPreview(objectUrl);

    setFitMode("contain");
    setZoom(1);
    setOffsetX(50);
    setOffsetY(50);
  }

  async function compressIfNeeded(original: File) {
    const options = {
      maxSizeMB: MAX_MB,
      maxWidthOrHeight: MAX_W,
      useWebWorker: true,
      initialQuality: 0.86,
      fileType: "image/jpeg" as const,
    };

    const compressed = await imageCompression(original, options);

    return new File([compressed], replaceExt(original.name, "jpg"), {
      type: "image/jpeg",
    });
  }

  async function handleSubmit() {
    setOkMsg("");
    setErrMsg("");

    if (!file) {
      setErrMsg("Selecione uma foto.");
      return;
    }

    if (!name.trim()) {
      setErrMsg("Digite seu nome (ou apelido).");
      return;
    }

    setLoading(true);

    try {
      const compressed = await compressIfNeeded(file);

      const prepared = await renderForLiveFrame(compressed, {
        fitMode,
        zoom,
        offsetX,
        offsetY,
        outputW: OUTPUT_W,
        outputH: OUTPUT_H,
      });

      const ts = Date.now();
      const safeName = name.trim().slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, "_") || "usuario";
      const path = `pending/${ts}_${safeName}.jpg`;

      const upload = await supabase.storage.from(bucket).upload(path, prepared, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg",
      });

      if (upload.error) throw upload.error;

      const finalCaption = caption.trim().slice(0, MAX_CAPTION_CHARS);

      const insert = await supabase.from("wall_photos").insert({
        display_name: name.trim(),
        instagram: instagram.trim() ? cleanHandle(instagram) : null,
        pet_name: petName.trim() || null,
        pet_age: petAge.trim() || null,
        city: city.trim() || null,
        state: stateUf.trim() || null,
        caption: finalCaption || null,
        storage_path: path,
        status: "pending",
      });

      if (insert.error) throw insert.error;

      setOkMsg("Recebido! Agora e so aguardar a aprovacao no mural.");
      setFile(null);
      clearPreview();
      setCaption("");
      setPetName("");
      setPetAge("");
      setCity("");
      setStateUf("");
      setFitMode("contain");
      setZoom(1);
      setOffsetX(50);
      setOffsetY(50);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falhou. Tente novamente.";
      setErrMsg(message);
    } finally {
      setLoading(false);
    }
  }

  const captionCount = caption.length;
  const previewPet = petName.trim() || "Nome do pet";
  const previewMeta = [
    city.trim() ? city.trim() : "Cidade",
    stateUf.trim() ? stateUf.trim().toUpperCase() : "UF",
    petAge.trim() ? `Idade: ${petAge.trim()}` : "Idade",
  ].join("  •  ");
  const previewCaption = caption.trim() || "Descricao ate 50 caracteres";

  return (
    <div className="wrap">
      <div className="card">
        <header className="head">
          <div className="title">Enviar foto</div>
          <div className="sub">
            Veja a simulacao de como a foto vai aparecer na live e ajuste antes de enviar.
          </div>
        </header>

        <div className="grid">
          <div className="uploader">
            <label className="pick">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPick(e.target.files?.[0] || null)}
                disabled={loading}
              />
              <div className="pickBox">
                <div className="pickTitle">Escolher foto</div>
                <div className="pickHint">JPG/PNG/WebP • auto otimizacao para live 16:9</div>
              </div>
            </label>

            <div className="previewBlock">
              {preview ? (
                <div className="previewStage" role="img" aria-label="Preview da live">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Preview"
                    className="previewImage"
                    style={{
                      objectFit: fitMode,
                      objectPosition: `${offsetX}% ${offsetY}%`,
                      transform: `scale(${zoom})`,
                    }}
                  />

                  <div className="previewOverlay">
                    <div className="previewLine1">
                      <span className="previewPet">{previewPet}</span>
                      <span className="previewMeta">{previewMeta}</span>
                    </div>
                    <div className="previewLine2">{previewCaption}</div>
                  </div>
                </div>
              ) : (
                <div className="previewEmpty">Preview da live aparece aqui</div>
              )}
            </div>

            <div className="adjustBox">
              <div className="adjustTitle">Ajuste de enquadramento</div>

              <div className="fitSwitch" role="group" aria-label="Modo de enquadramento">
                <button
                  type="button"
                  className={`fitBtn ${fitMode === "contain" ? "active" : ""}`}
                  onClick={() => setFitMode("contain")}
                  disabled={!preview || loading}
                >
                  Sem corte
                </button>
                <button
                  type="button"
                  className={`fitBtn ${fitMode === "cover" ? "active" : ""}`}
                  onClick={() => setFitMode("cover")}
                  disabled={!preview || loading}
                >
                  Preencher
                </button>
              </div>

              <label className="rangeField">
                <span>Zoom: {zoom.toFixed(2)}x</span>
                <input
                  type="range"
                  min={1}
                  max={2.2}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  disabled={!preview || loading}
                />
              </label>

              <div className="hint">
                Sem corte preserva a foto inteira. Preencher ocupa toda a area e pode cortar bordas.
              </div>
            </div>
          </div>

          <div className="form">
            <label className="field">
              <span>Seu nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Marcel Malta"
                disabled={loading}
              />
            </label>

            <label className="field">
              <span>Instagram (opcional)</span>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="Ex: @shihtzuz"
                disabled={loading}
              />
            </label>

            <label className="field">
              <span>Nome do pet (opcional)</span>
              <input
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="Ex: Thor"
                disabled={loading}
              />
            </label>

            <div className="inlineFields">
              <label className="field">
                <span>Idade (opcional)</span>
                <input
                  value={petAge}
                  onChange={(e) => setPetAge(e.target.value)}
                  placeholder="Ex: 2 anos"
                  disabled={loading}
                />
              </label>

              <label className="field">
                <span>Cidade (opcional)</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Sao Paulo"
                  disabled={loading}
                />
              </label>

              <label className="field">
                <span>UF (opcional)</span>
                <input
                  value={stateUf}
                  onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  disabled={loading}
                  maxLength={2}
                />
              </label>
            </div>

            <label className="field">
              <span>Descricao (max 50 caracteres)</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_CHARS))}
                placeholder="Ex: Meu filho pet chegou da tosa"
                rows={3}
                disabled={loading}
                maxLength={MAX_CAPTION_CHARS}
              />
              <small className="counter">{captionCount}/{MAX_CAPTION_CHARS}</small>
            </label>

            {errMsg ? <div className="msg err">{errMsg}</div> : null}
            {okMsg ? <div className="msg ok">{okMsg}</div> : null}

            <button className="btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Enviando..." : "Enviar agora"}
            </button>

            <div className="foot">
              Dica: escolha o enquadramento no preview. A imagem final ja sobe otimizada para live.
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 16px;
          background: radial-gradient(1200px 700px at 50% 0%, #101a28 0%, #070a0f 60%, #05070b 100%);
          color: #fff;
        }

        .card {
          width: min(1120px, 100%);
          border-radius: 22px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
          overflow: hidden;
        }

        .head {
          padding: 16px 16px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(5, 7, 11, 0.5);
          backdrop-filter: blur(10px);
        }

        .title {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.3px;
        }

        .sub {
          margin-top: 4px;
          font-size: 13px;
          opacity: 0.85;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 14px;
          padding: 14px;
        }

        .uploader {
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .pick {
          display: block;
          cursor: pointer;
        }

        .pick input {
          display: none;
        }

        .pickBox {
          border-radius: 18px;
          padding: 16px;
          border: 1px dashed rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.04);
        }

        .pickTitle {
          font-weight: 900;
        }

        .pickHint {
          margin-top: 4px;
          font-size: 12px;
          opacity: 0.82;
        }

        .previewBlock {
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.28);
          min-height: 260px;
          display: grid;
          place-items: center;
        }

        .previewStage {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #050505;
          overflow: hidden;
        }

        .previewImage {
          width: 100%;
          height: 100%;
          display: block;
          transition: transform 140ms ease;
        }

        .previewOverlay {
          position: absolute;
          left: 10px;
          right: 10px;
          bottom: 10px;
          border-radius: 12px;
          padding: 9px 10px;
          background: rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(245, 211, 122, 0.35);
          backdrop-filter: blur(8px);
          color: #fff5dd;
        }

        .previewLine1 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .previewPet {
          font-size: 16px;
          font-weight: 900;
          color: #f5d37a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .previewMeta {
          font-size: 11px;
          font-weight: 700;
          opacity: 0.9;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .previewLine2 {
          margin-top: 5px;
          font-size: 12px;
          font-weight: 600;
          opacity: 0.95;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .previewEmpty {
          padding: 20px;
          opacity: 0.75;
          font-weight: 700;
          text-align: center;
        }

        .adjustBox {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.3);
          padding: 12px;
          display: grid;
          gap: 10px;
        }

        .adjustTitle {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.2px;
        }

        .fitSwitch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .fitBtn {
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 12px;
          padding: 9px 10px;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
          font-weight: 800;
          cursor: pointer;
        }

        .fitBtn.active {
          color: #1a1307;
          background: linear-gradient(180deg, #f5d37a 0%, #c58d2f 100%);
          border-color: rgba(245, 211, 122, 0.8);
        }

        .fitBtn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .rangeField {
          display: grid;
          gap: 4px;
        }

        .rangeField span {
          font-size: 12px;
          font-weight: 700;
          opacity: 0.9;
        }

        .rangeField input[type="range"] {
          width: 100%;
        }

        .hint {
          font-size: 11px;
          opacity: 0.8;
          line-height: 1.35;
        }

        .form {
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .inlineFields {
          display: grid;
          grid-template-columns: 1fr 1fr 90px;
          gap: 10px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field span {
          font-size: 12px;
          opacity: 0.85;
          font-weight: 800;
        }

        .field input,
        .field textarea {
          width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.35);
          padding: 12px;
          color: #fff;
          outline: none;
        }

        .counter {
          font-size: 11px;
          opacity: 0.75;
          justify-self: end;
        }

        .msg {
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 800;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .msg.err {
          background: rgba(255, 60, 60, 0.12);
        }

        .msg.ok {
          background: rgba(60, 255, 160, 0.1);
        }

        .btn {
          border: 0;
          border-radius: 16px;
          padding: 12px 14px;
          cursor: pointer;
          font-weight: 900;
          color: #0b0f14;
          background: linear-gradient(180deg, #f4d58a 0%, #d7b35f 100%);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
        }

        .btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .foot {
          font-size: 12px;
          opacity: 0.75;
          line-height: 1.35;
        }

        @media (max-width: 1024px) {
          .inlineFields {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 820px) {
          .grid {
            grid-template-columns: 1fr;
          }

          .previewBlock {
            min-height: 220px;
          }

          .inlineFields {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
