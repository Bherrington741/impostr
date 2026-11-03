/**
 * Server-side room store facade — shared by all API routes.
 *
 * The engine runs here either way; only where rooms are PERSISTED differs:
 *   NEXT_PUBLIC_BACKEND=supabase → Supabase Postgres (service role).
 *   anything else (e.g. "server") → in-process memory, no database.
 *
 * Keeping one facade means the API routes stay completely store-agnostic —
 * swapping backends is an env var, not a code change.
 */
import type { ActionEnvelope } from "@/lib/game/protocol";
import type { PrivateView, PublicState } from "@/lib/game/types";
import * as supabaseStore from "./supabase-store";
import * as memoryStore from "./memory-store";

export type ServerStoreKind = "supabase" | "memory";

interface StoreImpl {
  createRoom(
    code: string,
    host: { id: string; name: string; emoji: string },
    opts: { packKey: string; timerMinutes: number },
  ): Promise<PublicState>;
  generateUniqueCode(): Promise<string>;
  applyEnvelope(code: string, envelope: ActionEnvelope): Promise<boolean>;
  readPrivateView(code: string, playerId: string, secret: string): Promise<PrivateView | null>;
  readPublic(code: string): Promise<PublicState | null>;
}

export function serverStoreKind(): ServerStoreKind {
  const configured = (process.env.NEXT_PUBLIC_BACKEND ?? "local").toLowerCase();
  const hasSupabase = Boolean(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (configured === "supabase" && hasSupabase) return "supabase";
  return "memory";
}

function impl(): StoreImpl {
  // Resolved lazily so unused branches stay tree-shakeable.
  return serverStoreKind() === "supabase" ? supabaseStore : memoryStore;
}

export async function createRoom(
  code: string,
  host: { id: string; name: string; emoji: string },
  opts: { packKey: string; timerMinutes: number },
): Promise<PublicState> {
  return impl().createRoom(code, host, opts);
}

export async function generateUniqueCode(): Promise<string> {
  return impl().generateUniqueCode();
}

export async function applyEnvelope(code: string, envelope: ActionEnvelope): Promise<boolean> {
  return impl().applyEnvelope(code, envelope);
}

export async function readPrivateView(
  code: string,
  playerId: string,
  secret: string,
): Promise<PrivateView | null> {
  return impl().readPrivateView(code, playerId, secret);
}

export async function readPublic(code: string): Promise<PublicState | null> {
  return impl().readPublic(code);
}
