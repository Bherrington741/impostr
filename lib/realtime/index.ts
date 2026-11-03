/**
 * Transport factory.
 *
 * NEXT_PUBLIC_BACKEND = "local"    → multi-tab BroadcastChannel mode (default).
 * NEXT_PUBLIC_BACKEND = "server"   → server-authoritative API routes + in-memory
 *                                    store. No database needed.
 * NEXT_PUBLIC_BACKEND = "supabase" → server-authoritative API routes + Supabase
 *                                    Postgres/Realtime.
 */
import { createLocalRoomClient, ensureLocalRoom, localRoomExists } from "./local";
import { SupabaseRoomClient } from "./supabase";
import { PollRoomClient } from "./poll";
import type { RoomClient } from "./types";

export function backendKind(): "local" | "supabase" | "server" {
  const configured = (process.env.NEXT_PUBLIC_BACKEND ?? "local").toLowerCase();
  if (configured === "supabase" && process.env.NEXT_PUBLIC_SUPABASE_URL) return "supabase";
  if (configured === "server") return "server";
  return "local";
}

export function createRoomClient(code: string): RoomClient {
  const kind = backendKind();
  if (kind === "supabase") return new SupabaseRoomClient(code);
  if (kind === "server") return new PollRoomClient(code);
  return createLocalRoomClient(code);
}

export { ensureLocalRoom, localRoomExists };
