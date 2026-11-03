/**
 * NO-DATABASE server store — rooms live entirely in this Node process's
 * memory. The same pure engine that powers local mode runs here, so gameplay
 * rules are identical across backends.
 *
 * Trade-offs (documented in README):
 *  - rooms vanish when the server restarts (PM2 stop/deploy/reboot);
 *    a party in progress is expected to be short-lived, so this is fine
 *  - all API routes must be served by ONE process (PM2 fork mode, no cluster)
 *
 * The store survives dev-server HMR by parking its maps on `globalThis`.
 */
import {
  applyAction,
  generateRoomCode,
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
const ROOM_IDLE_MS = 12 * 60 * 60 * 1000; // drop rooms idle > 12h
const PRUNE_EVERY_MS = 10 * 60 * 1000;

interface MemRoom {
  pub: PublicState;
  priv: PrivateBundle;
  /** playerId → identity secret, registered at join time. */
  secrets: Map<string, string>;
  /** playerId → latest per-player private view (server-minted only). */
  views: Map<string, PrivateView>;
  /** playerId → last heartbeat epoch ms. */
  presence: Map<string, number>;
  updatedAt: number;
}

interface ImpostrGlobal {
  __impostrMemRooms?: Map<string, MemRoom>;
  __impostrMemPrune?: ReturnType<typeof setInterval>;
}

const g = globalThis as unknown as ImpostrGlobal;

function roomsMap(): Map<string, MemRoom> {
  if (!g.__impostrMemRooms) g.__impostrMemRooms = new Map();
  // Housekeeping sweep — started once per process, never blocks the event loop.
  if (!g.__impostrMemPrune) {
    g.__impostrMemPrune = setInterval(() => {
      const rooms = g.__impostrMemRooms;
      if (!rooms) return;
      const cutoff = Date.now() - ROOM_IDLE_MS;
      for (const [code, room] of rooms) {
        if (room.updatedAt < cutoff) rooms.delete(code);
      }
    }, PRUNE_EVERY_MS);
  }
  return g.__impostrMemRooms;
}

function loadModel(code: string): GameModel | null {
  const room = roomsMap().get(code);
  if (!room) return null;
  const now = Date.now();
  const connected = new Set<string>();
  for (const [playerId, ts] of room.presence) {
    const grace = playerId === room.pub.hostId ? HOST_GRACE_MS : CONNECTED_STALE_MS;
    if (now - ts <= grace) connected.add(playerId);
  }
  markPresence(room.pub, connected);
  return { pub: room.pub, priv: room.priv };
}

async function persist(code: string, model: GameModel) {
  const room = roomsMap().get(code);
  if (!room) return;
  room.pub = model.pub;
  room.priv = model.priv;
  room.updatedAt = Date.now();
  // Re-mint per-player views whenever the hidden state changed. They live
  // only here; the private route re-verifies the identity secret before serving.
  const views = issuePrivateViews(model.pub, model.priv, (id) => room.secrets.get(id));
  room.views.clear();
  for (const v of views) room.views.set(v.playerId, v.view);
}

export async function createRoom(
  code: string,
  host: { id: string; name: string; emoji: string },
  opts: { packKey: string; timerMinutes: number },
): Promise<PublicState> {
  const pub = newState(code, host, opts);
  roomsMap().set(code, {
    pub,
    priv: emptyBundle(),
    secrets: new Map(),
    views: new Map(),
    // Seed the host's heartbeat NOW: guests can poll the room long before the
    // host tab's first join lands, and an untracked host would look "dropped"
    // within CONNECTED_STALE_MS — hostMigration could steal the room.
    presence: new Map([[host.id, Date.now()]]),
    updatedAt: Date.now(),
  });
  return pub;
}

export async function generateUniqueCode(): Promise<string> {
  const rooms = roomsMap();
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateRoomCode();
    if (!rooms.has(code)) return code;
  }
  throw new Error("Room code space exhausted");
}

export async function applyEnvelope(code: string, envelope: ActionEnvelope): Promise<boolean> {
  const model = loadModel(code);
  if (!model) return false;
  const room = roomsMap().get(code)!;

  if (envelope.action.t === "ping") {
    room.presence.set(envelope.playerId, Date.now());
    // cheap lazy tick so timers can advance even between real actions
    if (tick(model)) {
      await persist(code, model);
      return true;
    }
    return false;
  }

  if (envelope.action.t === "join") {
    room.secrets.set(envelope.playerId, envelope.secret);
    room.presence.set(envelope.playerId, Date.now());
  }

  registerSecret(envelope.playerId, envelope.secret);
  const res = applyAction(model, envelope);
  if (res.changed) {
    await persist(code, model);
  }
  return res.changed;
}

export async function readPrivateView(
  code: string,
  playerId: string,
  secret: string,
): Promise<PrivateView | null> {
  const room = roomsMap().get(code);
  if (!room) return null;
  if (room.secrets.get(playerId) !== secret) return null; // device must own the identity
  const view = room.views.get(playerId) ?? null;
  if (view && view.playerId !== playerId) return null;
  // Ownership proven via secret match — safe to serve.
  return view;
}

export async function readPublic(code: string): Promise<PublicState | null> {
  const model = loadModel(code);
  if (!model) return null;
  tick(model);
  await persist(code, model);
  return model.pub;
}
