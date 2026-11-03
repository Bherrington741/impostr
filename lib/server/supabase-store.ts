/**
 * Server-side store for the Supabase backend.
 * All access uses the service role — clients never touch private tables.
 * The same pure engine that powers local mode runs here, so gameplay rules
 * are identical across backends.
 *
 * Selected by `lib/server/rooms.ts` when NEXT_PUBLIC_BACKEND=supabase.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  applyAction,
  issuePrivateViews,
  markPresence,
  newState,
  registerSecret,
  tick,
  type GameModel,
} from "@/lib/game/engine";
import { emptyBundle, type PrivateBundle, type PrivateView, type PublicState } from "@/lib/game/types";
import type { ActionEnvelope } from "@/lib/game/protocol";

const CONNECTED_STALE_MS = 9000;
/** Hosts get a longer grace so a slow-loading host tab can't lose the room
 *  to hostMigration on another guest's first poll. */
const HOST_GRACE_MS = 60_000;

let cached: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (!cached) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server env not configured");
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}

export async function createRoom(
  code: string,
  host: { id: string; name: string; emoji: string },
  opts: { packKey: string; timerMinutes: number },
): Promise<PublicState> {
  const sb = serviceClient();
  const pub = newState(code, host, opts);
  const { error } = await sb.from("rooms").upsert(
    { code, public_state: pub, updated_at: new Date().toISOString() },
    { onConflict: "code" },
  );
  if (error) throw new Error(error.message);
  // Seed the host's heartbeat NOW: guests can poll the room long before the
  // host tab's first join lands, and an untracked host would look "dropped"
  // within CONNECTED_STALE_MS — hostMigration could steal the room.
  await sb
    .from("room_presence")
    .upsert({ code, player_id: host.id, ts: new Date().toISOString() }, { onConflict: "code,player_id" });
  return pub;
}

export async function generateUniqueCode(): Promise<string> {
  const sb = serviceClient();
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = newCodeLocal();
    const { data } = await sb.from("rooms").select("code").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Room code space exhausted");
}

function newCodeLocal(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O — easier to read aloud
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function loadModel(sb: SupabaseClient, code: string): Promise<GameModel | null> {
  const [{ data: room, error }, { data: privRow }] = await Promise.all([
    sb.from("rooms").select("code, public_state").eq("code", code).single(),
    sb.from("room_state_private").select("private_state").eq("code", code).single(),
  ]);
  if (error || !room) return null;
  const pub = room.public_state as PublicState;
  const priv = (privRow?.private_state as PrivateBundle | null) ?? emptyBundle();

  // hydrate presence before any engine work.
  // Hosts get a longer grace so a slow-loading host tab can't lose the room
  // to hostMigration on another guest's first poll.
  const { data: pres } = await sb.from("room_presence").select("player_id, ts").eq("code", code);
  const now = Date.now();
  const connected = new Set<string>();
  for (const row of pres ?? []) {
    const age = now - new Date(row.ts).getTime();
    const grace = row.player_id === pub.hostId ? HOST_GRACE_MS : CONNECTED_STALE_MS;
    if (age <= grace) connected.add(row.player_id);
  }
  markPresence(pub, connected);
  return { pub, priv };
}

async function persist(
  sb: SupabaseClient,
  code: string,
  model: GameModel,
  issued: Array<{ playerId: string; secret: string }> = [],
) {
  const now = new Date().toISOString();
  // Public row: what every client is allowed to see via Realtime.
  const { error } = await sb
    .from("rooms")
    .update({ public_state: model.pub, updated_at: now })
    .eq("code", code);
  if (error) throw new Error(error.message);
  // Hidden bundle: its own table with NO anon policies — postgres_changes on
  // `rooms` can therefore never leak the secret word or the imposter id.
  await sb
    .from("room_state_private")
    .upsert({ code, private_state: model.priv, updated_at: now }, { onConflict: "code" });

  if (issued.length) {
    // Mint + store per-player private views. `room_views` has NO select
    // policies for anon — only the private-view route may serve them,
    // and only after re-verifying the requester's identity secret.
    const { data: secretRows } = await sb
      .from("room_players")
      .select("player_id, secret")
      .eq("code", code);
    const secrets = new Map((secretRows ?? []).map((r) => [r.player_id, r.secret]));
    const views = issuePrivateViews(model.pub, model.priv, (id) => secrets.get(id));
    if (views.length) {
      await sb.from("room_views").upsert(
        views.map((v) => ({ code, player_id: v.playerId, round: model.pub.round, view: v.view })),
        { onConflict: "code,player_id" },
      );
    }
    // Realtime nudge: clients refetch their own private view.
    await sb.channel(`nudge:${code}`).send({ type: "broadcast", event: "pvnudge", payload: { t: Date.now() } });
  }
}

export async function applyEnvelope(code: string, envelope: ActionEnvelope): Promise<boolean> {
  const sb = serviceClient();
  const model = await loadModel(sb, code);
  if (!model) return false;

  const t = envelope.action.t;

  if (t === "ping") {
    await sb
      .from("room_presence")
      .upsert({ code, player_id: envelope.playerId, ts: new Date().toISOString() }, { onConflict: "code,player_id" });
    // cheap lazy tick so timers can advance even between real actions
    if (tick(model)) {
      await persist(sb, code, model);
      return true;
    }
    return false;
  }

  if (t === "join") {
    await sb.from("room_players").upsert(
      { code, player_id: envelope.playerId, secret: envelope.secret },
      { onConflict: "code,player_id" },
    );
    await sb
      .from("room_presence")
      .upsert({ code, player_id: envelope.playerId, ts: new Date().toISOString() }, { onConflict: "code,player_id" });
  }

  registerSecret(envelope.playerId, envelope.secret);
  const res = applyAction(model, envelope);
  if (res.changed) {
    await persist(sb, code, model, res.views.map((v) => ({ playerId: v.playerId, secret: v.secret })));
  }
  return res.changed;
}

export async function readPrivateView(
  code: string,
  playerId: string,
  secret: string,
): Promise<PrivateView | null> {
  const sb = serviceClient();
  const { data: player } = await sb
    .from("room_players")
    .select("secret")
    .eq("code", code)
    .eq("player_id", playerId)
    .single();
  if (!player || player.secret !== secret) return null; // device must own the identity
  const { data: row } = await sb
    .from("room_views")
    .select("view")
    .eq("code", code)
    .eq("player_id", playerId)
    .single();
  const view = row?.view as PrivateView | undefined;
  if (!view || view.playerId !== playerId) return null;
  // Ownership proven via secret match in room_players — safe to serve.
  return view;
}

export async function readPublic(code: string): Promise<PublicState | null> {
  const sb = serviceClient();
  const model = await loadModel(sb, code);
  if (!model) return null;
  tick(model);
  await persist(sb, code, model);
  return model.pub;
}
