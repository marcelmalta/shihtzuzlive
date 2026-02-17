import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const { pass, id, status } = await req.json();

    if (!pass || pass !== process.env.ADMIN_PASS) {
      return NextResponse.json({ error: "Senha inválida" }, { status: 401 });
    }
    if (!id || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const supabase = supabaseServer();

    const { error } = await supabase
      .from("wall_photos")
      .update({ status })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro" }, { status: 500 });
  }
}
