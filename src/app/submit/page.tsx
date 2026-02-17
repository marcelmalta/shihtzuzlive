"use client";

import { useMemo, useState } from "react";
import imageCompression from "browser-image-compression";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function SubmitPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";
  const MAX_MB = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB || 3); // limite final (após compressão)
  const MAX_W = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_W || 1920); // largura max

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  function cleanHandle(s: string) {
    return s.trim().replace(/^@+/, "");
  }

  async function onPick(f?: File | null) {
    setOkMsg("");
    setErrMsg("");

    if (!f) {
      setFile(null);
      setPreview("");
      return;
    }

    if (!f.type.startsWith("image/")) {
      setErrMsg("Escolha uma imagem (JPG/PNG/WebP).");
      return;
    }

    // preview imediato (original)
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function compressIfNeeded(original: File) {
    // alvo: JPEG/WebP leve, mantendo qualidade boa
    const options = {
      maxSizeMB: MAX_MB,
      maxWidthOrHeight: MAX_W,
      useWebWorker: true,
      initialQuality: 0.85,
      fileType: "image/jpeg" as const,
    };

    const compressed = await imageCompression(original, options);

    // garante tipo File
    return new File([compressed], replaceExt(original.name, "jpg"), {
      type: "image/jpeg",
    });
  }

  function replaceExt(filename: string, newExt: string) {
    const base = filename.replace(/\.[^/.]+$/, "");
    return `${base}.${newExt}`;
  }

  async function handleSubmit() {
    setOkMsg("");
    setErrMsg("");

    if (!file) return setErrMsg("Selecione uma foto.");
    if (!name.trim()) return setErrMsg("Digite seu nome (ou apelido).");

    setLoading(true);

    try {
      // 1) comprime
      const compressed = await compressIfNeeded(file);

      // 2) cria path em pending/
      const ts = Date.now();
      const safeName = name.trim().slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, "_");
      const path = `pending/${ts}_${safeName}.jpg`;

      // 3) upload
      const up = await supabase.storage.from(bucket).upload(path, compressed, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg",
      });

      if (up.error) throw up.error;

      // 4) grava metadados no banco (status pending)
      const ins = await supabase.from("wall_photos").insert({
        display_name: name.trim(),
        instagram: instagram.trim() ? cleanHandle(instagram) : null,
        caption: caption.trim() ? caption.trim() : null,
        storage_path: path,
        status: "pending",
      });

      if (ins.error) throw ins.error;

      // 5) sucesso
      setOkMsg("Recebido ✅ Agora é só aguardar a aprovação no mural!");
      setFile(null);
      setPreview("");
      setCaption("");
      // mantém nome/instagram para facilitar novo envio
    } catch (e: any) {
      setErrMsg(e?.message || "Falhou. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        <header className="head">
          <div className="title">Enviar foto</div>
          <div className="sub">Sua foto vai para análise e aparece na live após aprovação.</div>
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
                <div className="pickTitle">Toque para escolher a foto</div>
                <div className="pickHint">JPG/PNG/WebP • otimizada automaticamente</div>
              </div>
            </label>

            {preview ? (
              <div className="preview">
                <img src={preview} alt="Preview" />
              </div>
            ) : (
              <div className="preview empty">Preview aparece aqui</div>
            )}
          </div>

          <div className="form">
            <label className="field">
              <span>Nome</span>
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
              <span>Mensagem (opcional)</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ex: Meu filho Pet 🐶"
                rows={3}
                disabled={loading}
              />
            </label>

            {errMsg ? <div className="msg err">{errMsg}</div> : null}
            {okMsg ? <div className="msg ok">{okMsg}</div> : null}

            <button className="btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Enviando..." : "Enviar agora"}
            </button>

            <div className="foot">
              Dica: use Wi-Fi para enviar mais rápido. Limite alvo: {MAX_MB}MB.
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
          width: min(980px, 100%);
          border-radius: 22px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.10);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
          overflow: hidden;
        }

        .head {
          padding: 16px 16px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(5, 7, 11, 0.50);
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
          opacity: 0.8;
        }

        .preview {
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(0, 0, 0, 0.25);
          min-height: 320px;
          display: grid;
          place-items: center;
        }
        .preview img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        .preview.empty {
          opacity: 0.75;
          font-weight: 700;
        }

        .form {
          display: grid;
          gap: 12px;
          align-content: start;
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
          padding: 12px 12px;
          color: #fff;
          outline: none;
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
          background: rgba(60, 255, 160, 0.10);
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
          opacity: 0.7;
        }

        /* MOBILE */
        @media (max-width: 820px) {
          .grid {
            grid-template-columns: 1fr;
          }
          .preview {
            min-height: 240px;
          }
        }
      `}</style>
    </div>
  );
}
