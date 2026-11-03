import { NextResponse } from "next/server";
import { readPrivateView } from "@/lib/server/rooms";

/**
 * Per-player private view endpoint.
 *
 * ANTI-CHEAT: the request must carry the identity secret that was registered
 * when the player joined — a random tab can guess a playerId, but never the
 * per-device secret, so it can only ever read its own role.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId") ?? "";
  const secret = url.searchParams.get("secret") ?? "";
  if (!playerId || !secret) {
    return NextResponse.json({ view: null });
  }
  try {
    const view = await readPrivateView(raw.toUpperCase(), playerId, secret);
    return NextResponse.json({ view });
  } catch {
    return NextResponse.json({ view: null });
  }
}
