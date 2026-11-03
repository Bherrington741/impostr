import { NextResponse } from "next/server";
import { applyEnvelope, readPublic } from "@/lib/server/rooms";

/** GET public state (with a lazy engine tick so timers keep moving). */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  try {
    const state = await readPublic(raw.toUpperCase());
    return NextResponse.json({ state });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

/** POST an action envelope (validated by the engine, server-authoritative). */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  try {
    const env = (await req.json()) as {
      id: string;
      playerId: string;
      secret: string;
      action: unknown;
    };
    if (!env?.id || !env?.playerId || !env?.secret || !env?.action) {
      return NextResponse.json({ error: "Malformed envelope" }, { status: 400 });
    }
    const changed = await applyEnvelope(raw.toUpperCase(), {
      id: env.id,
      playerId: env.playerId,
      secret: env.secret,
      action: env.action as never,
    });
    return NextResponse.json({ ok: true, changed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
