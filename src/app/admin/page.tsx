"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type WallPhoto = {
  id: string;
  created_at: string;
  display_name: string | null;
  instagram: string | null;
  caption: string | null;
  storage_path: string;
  status: "pending" | "approved" | "rejected";
};

export default function AdminPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const bucket = process.env.NEXT_PUBLIC_BUCKET || "shihtzu-wall";

  const [pass, setPass] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<WallPhoto[]>([]);
  const [msg, setMsg] = useState("");

  async function getUrl(path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function loadPending() {
    setMsg("");
    const { data, error } = await supabase
      .from("wall_photos")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) setMsg(`Erro: ${error.message}`);
    else setItems((data as WallPhoto[]) || []);
  }

  async function action(id: string, status: "approved" | "rejected") {
    setMsg("");
    const res = await fetch("/api/admin/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass, id, status }),
    });
    const json = await res.json();
    if (!res.ok) return setMsg(json?.error || "Erro");
    setMsg("OK");
    loadPending();
  }

  useEffect(() => {
    if (!authed) return;
    loadPending();
  }, [authed]);

  if (!authed) {
    return (
      <div style={{ maxWidth: 520, margin: "24px auto", padding: 16 }}>
        <h1>Admin</h1>
        <p>Digite a senha do admin (local):</p>
        <input value={pass} onChange={(e) => setPass(e.target.value)} style={inp} type="password" />
        <button style={btn} onClick={() => setAuthed(true)}>Entrar</button>
        <p style={{ marginTop: 10, color: "#666" }}>
          Dica: use essa página só você. A aprovação acontece via backend com Service Role.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>
      <h1>Admin • Pendentes</h1>
      <p>
        <a href="/live">Live</a> • <a href="/submit">Submit</a>
      </p>

      <button style={btn} onClick={loadPending}>Atualizar</button>
      {msg && <p style={{ color: msg.startsWith("Erro") ? "#b00020" : "#0a6" }}>{msg}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginTop: 16 }}>
        {items.map((it) => (
          <Card key={it.id} it={it} getUrl={getUrl} onApprove={() => action(it.id, "approved")} onReject={() => action(it.id, "rejected")} />
        ))}
      </div>
    </div>
  );
}

function Card({
  it,
  getUrl,
  onApprove,
  onReject,
}: {
  it: WallPhoto;
  getUrl: (p: string) => Promise<string>;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    (async () => setUrl(await getUrl(it.storage_path)))();
  }, [it.id]);

  return (
    <div style={card}>
      <div style={{ aspectRatio: "1 / 1", background: "#111", borderRadius: 14, overflow: "hidden" }}>
        {url ? <img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 800 }}>{it.display_name || "Seguidor"} {it.instagram ? `• ${it.instagram}` : ""}</div>
        <div style={{ opacity: 0.8, fontSize: 13 }}>{new Date(it.created_at).toLocaleString()}</div>
        {it.caption ? <div style={{ marginTop: 6 }}>{it.caption}</div> : null}

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button style={{ ...btn, background: "#0a6" }} onClick={onApprove}>Aprovar</button>
          <button style={{ ...btn, background: "#b00020" }} onClick={onReject}>Reprovar</button>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ccc",
  fontSize: 14,
  width: "100%",
  marginBottom: 10,
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "0",
  background: "#111",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const card: React.CSSProperties = {
  background: "#0f1723",
  border: "1px solid #223044",
  borderRadius: 18,
  padding: 12,
  color: "#fff",
};
