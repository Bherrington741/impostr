import { NextResponse } from "next/server";
import { createRoom, generateUniqueCode } from "@/lib/server/rooms";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      host: { id: string; name: string; emoji: string; secret?: string };
      packKey?: string;
      timerMinutes?: number;
    };
    if (!body?.host?.id) {
      return NextResponse.json({ error: "Missing host identity" }, { status: 400 });
    }
    const code = (await generateUniqueCode()).toUpperCase();
    const state = await createRoom(code, body.host, {
      packKey: body.packKey ?? "random",
      timerMinutes: body.timerMinutes ?? 3,
    });
    return NextResponse.json({ ok: true, code, state });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
