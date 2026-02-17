"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function SubmitPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [caption, setCaption] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";
  const prefix = process.env.NEXT_PUBLIC_UPLOAD_PREFIX || "pending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!file) return setMsg("Selecione uma imagem.");

    // validação básica
    const okTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!okTypes.includes(file.type)) return setMsg("Use JPG, PNG ou WEBP.");
    if (file.size > 6 * 1024 * 1024) return setMsg("Máx 6MB.");

    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const safeName = (displayName || "anon")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 24);

      const path = `${prefix}/${Date.now()}-${safeName}.${ext}`;

      const up = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

      if (up.error) throw up.error;

      const ins = await supabase.from("wall_photos").insert({
        display_name: displayName || null,
        instagram: instagram || null,
        caption: caption || null,
        storage_path: path,
        status: "pending",
      });

      if (ins.error) throw ins.error;

      setMsg("Enviado! Agora aguarde aprovação 🙂");
      setFile(null);
      setDisplayName("");
      setInstagram("");
      setCaption("");
      (document.getElementById("file") as HTMLInputElement | null)?.value && ((document.getElementById("file") as HTMLInputElement).value = "");
    } catch (err: any) {
      setMsg(`Erro: ${err?.message || "falha no envio"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: 16 }}>
      <h1>Enviar foto do seu Shih Tzu 🐶</h1>
      <p style={{ color: "#444" }}>
        Sua foto entra na fila e aparece na live após aprovação.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input id="file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />

        <input
          placeholder="Seu nome (opcional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={inp}
        />
        <input
          placeholder="@instagram (opcional)"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          style={inp}
        />
        <input
          placeholder="Legenda curta (opcional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          style={inp}
        />

        <label style={{ fontSize: 14, color: "#333" }}>
          <input type="checkbox" required /> Confirmo que tenho autorização para enviar esta imagem.
        </label>

        <button disabled={loading} style={btn}>
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </form>

      {msg && <p style={{ marginTop: 12, color: msg.startsWith("Erro") ? "#b00020" : "#0a6" }}>{msg}</p>}

      <hr style={{ margin: "24px 0" }} />
      <p>
        <a href="/live">Ver mural (live)</a> • <a href="/admin">Admin</a>
      </p>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ccc",
  fontSize: 14,
};

const btn: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "0",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
