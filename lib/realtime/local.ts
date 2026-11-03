/**
 * LOCAL BACKEND — zero-config multiplayer across browser tabs.
 *
 * Design (all same-origin tabs share storage + BroadcastChannel):
 *
 *  PUBLIC STATE   `impostr:pub:{code}`     readable JSON, always safe to leak
 *  AUTHORITY      `impostr:meta:{code}`    { authorityId, hb, priv(scrambled) }
 *  PRESENCE       `impostr:pres:{code}:{playerId}`  { ts } heartbeat per tab
 *  PRIVATE VIEWS  `impostr:pv:{code}:{playerId}`    scrambled shard per player
 *  SECRETS        `impostr:sec:{code}:{playerId}`   secret, written by owner tab
 *  CHANNEL        BroadcastChannel(`impostr-ch-{code}`)
 *
 * - One tab acts as the AUTHORITY (owns the PrivateBundle, runs the engine
 *   tick loop). Any other tab can take over after a stale heartbeat, which
 *   makes host migration work even if the host tab closes.
 * - Actions travel over the channel; a per-action id keeps them idempotent.
 * - Private views are NEVER placed on the channel. They are scrambled into
 *   per-player storage shards written by the authority; each tab can only
 *   successfully verify the shard built from ITS OWN identity secret.
 * - Secret shards are written by each tab for its own playerId only, so the
 *   authority can mint views without secrets ever crossing the channel.
 */

import { applyAction, cloneModel, issuePrivateViews, markPresence, newState, registerSecret, tick, type GameModel, type IssuedView } from "@/lib/game/engine";
import { makeEnvelope, type Action, type ActionEnvelope } from "@/lib/game/protocol";
import type { PrivateBundle, PrivateView, PublicState } from "@/lib/game/types";
import { emptyBundle } from "@/lib/game/types";
import type { RoomIdentity } from "@/lib/game/identity";
import { descrambleJson, scrambleJson } from "./scramble";
import type { CreatedRoomInfo, RoomClient, RoomClientHandlers } from "./types";

declare global {
  interface Window {
    __impostrDebug?: { received: number; lastPublicAt: number; lastMsgType: string | null; connectedAt: number };
  }
}

const AUTHORITY_STALE_MS = 4000;
const PRESENCE_STALE_MS = 9000;
const TICK_MS = 900;
const PING_MS = 2500;

const pubKey = (c: string) => `impostr:pub:${c}`;
const metaKey = (c: string) => `impostr:meta:${c}`;
const presKey = (c: string, p: string) => `impostr:pres:${c}:${p}`;
const pvKey = (c: string, p: string) => `impostr:pv:${c}:${p}`;
const secKey = (c: string, p: string) => `impostr:sec:${c}:${p}`;
const chanName = (c: string) => `impostr-ch-${c}`;

interface Meta {
  authorityId: string;
  hb: number;
  priv: string | null; // scrambled PrivateBundle
}

interface ChannelMsg {
  type: "public" | "action" | "pvnudge";
  s?: PublicState;
  env?: ActionEnvelope;
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function lsDel(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readPublic(code: string): PublicState | null {
  const raw = lsGet(pubKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PublicState;
  } catch {
    return null;
  }
}

function readMeta(code: string): Meta | null {
  const raw = lsGet(metaKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Meta;
  } catch {
    return null;
  }
}

function loadModel(code: string): GameModel | null {
  const pub = readPublic(code);
  if (!pub) return null;
  const meta = readMeta(code);
  const priv: PrivateBundle = (meta?.priv && descrambleJson<PrivateBundle>(meta.priv, code)) || emptyBundle();
  return { pub, priv };
}

/** Called once by the room creator (home screen) — writes initial lobby state. */
export function ensureLocalRoom(
  code: string,
  host: RoomIdentity,
  opts: { packKey: string; timerMinutes: number },
): CreatedRoomInfo {
  const existing = readPublic(code);
  if (!existing || existing.players.length === 0) {
    const pub = newState(code, { id: host.playerId, name: host.name, emoji: host.emoji }, opts);
    lsSet(pubKey(code), JSON.stringify(pub));
  }
  lsSet(secKey(code, host.playerId), host.secret);
  return { ok: true, code };
}

export function localRoomExists(code: string): boolean {
  return readPublic(code) !== null;
}

export class LocalRoomClient implements RoomClient {
  kind = "local" as const;
  private code: string;
  private identity!: RoomIdentity;
  private handlers!: RoomClientHandlers;
  private channel: BroadcastChannel | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private onStorage: ((e: StorageEvent) => void) | null = null;
  private onUnload: (() => void) | null = null;

  constructor(code: string) {
    this.code = code.toUpperCase();
  }

  connect(identity: RoomIdentity, handlers: RoomClientHandlers) {
    this.identity = identity;
    this.handlers = handlers;

    // The identity secrets registry lives in engine module state and is fed by
    // join envelopes. This tab may have (re)loaded mid-game, so also seed it
    // from the storage shards that each player tab writes for itself — without
    // this, a reloaded authority cannot mint private views for players who
    // joined before its page load, and role cards would go missing or stale.
    this.syncSecrets();

    try {
      this.channel = new BroadcastChannel(chanName(this.code));
      const debug = { received: 0, lastPublicAt: 0, lastMsgType: null as string | null, connectedAt: Date.now() };
      window.__impostrDebug = debug;
      this.channel.onmessage = (e: MessageEvent<ChannelMsg>) => {
        const msg = e.data;
        debug.received += 1;
        debug.lastMsgType = msg.type;
        if (msg.type === "public") debug.lastPublicAt = Date.now();
        if (msg.type === "public" && msg.s) handlers.onPublic(msg.s);
        else if (msg.type === "pvnudge") handlers.onPrivateInvalidated();
        else if (msg.type === "action" && msg.env) this.authorityStep(msg.env);
      };
    } catch {
      this.channel = null; // very old browsers: storage-event polling only
    }

    this.onStorage = (e) => {
      if (e.key === pubKey(this.code)) {
        const s = readPublic(this.code);
        if (s) handlers.onPublic(s);
      } else if (e.key === pvKey(this.code, identity.playerId)) {
        handlers.onPrivateInvalidated();
      }
    };
    window.addEventListener("storage", this.onStorage);

    this.onUnload = () => {
      // Notify presence sweep immediately so viewers see us drop fast.
      lsSet(presKey(this.code, identity.playerId), JSON.stringify({ ts: 0 }));
    };
    window.addEventListener("pagehide", this.onUnload);
    document.addEventListener("visibilitychange", this.onUnload);

    this.ping();
    this.pingTimer = setInterval(() => this.ping(), PING_MS);
    this.tickTimer = setInterval(() => this.authorityStep(null), TICK_MS);
    // Kick an initial join + public fetch synchronously.
    this.send({ t: "join", player: { id: identity.playerId, name: identity.name, emoji: identity.emoji } });
    const initialPublic = readPublic(this.code);
    if (initialPublic) handlers.onPublic(initialPublic);
    handlers.onPrivateInvalidated();
  }

  destroy() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    window.removeEventListener("storage", this.onStorage as never);
    window.removeEventListener("pagehide", this.onUnload as never);
    document.removeEventListener("visibilitychange", this.onUnload as never);
    this.channel?.close();
    this.channel = null;
  }

  send(action: Action) {
    const env = makeEnvelope(this.identity.playerId, this.identity.secret, action);
    this.channel?.postMessage({ type: "action", env } satisfies ChannelMsg);
    // BroadcastChannel doesn't echo to the sender — if we happen to be the
    // authority, apply immediately so the host UI feels instant.
    this.authorityStep(env);
  }

  /** Presence heartbeat for this tab. */
  private ping() {
    const active = document.visibilityState !== "hidden";
    lsSet(
      presKey(this.code, this.identity.playerId),
      JSON.stringify({ ts: active ? Date.now() : 0 }),
    );
    lsSet(secKey(this.code, this.identity.playerId), this.identity.secret);
  }

  /** Load every player's self-written secret shard into the engine registry. */
  private syncSecrets() {
    const prefix = `impostr:sec:${this.code}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const playerId = key.slice(prefix.length);
      const secret = lsGet(key);
      if (playerId && secret) registerSecret(playerId, secret);
    }
  }

  private connectedIds(): Set<string> {
    const now = Date.now();
    const out = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(`impostr:pres:${this.code}:`)) continue;
      try {
        const rec = JSON.parse(lsGet(key) ?? "{}") as { ts: number };
        if (rec.ts && now - rec.ts <= PRESENCE_STALE_MS) {
          out.add(key.slice(key.lastIndexOf(":") + 1));
        }
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  /**
   * Authority election + engine tick. Idempotent, safe to race: claimwrites
   * are verified by a re-read, so only one tab wins.
   */
  private authorityStep(incoming: ActionEnvelope | null) {
    const code = this.code;
    const meta = readMeta(code);
    const now = Date.now();
    let metaLive = meta !== null && now - meta.hb <= AUTHORITY_STALE_MS && meta.priv !== null;
    let isMe = metaLive && meta!.authorityId === this.identity.playerId;

    if (!isMe && (!metaLive || meta!.authorityId === this.identity.playerId)) {
      // Claim or refresh heartbeat, preserving the private bundle for handover.
      const keepPriv = meta?.priv ?? null;
      lsSet(metaKey(code), JSON.stringify({ authorityId: this.identity.playerId, hb: now, priv: keepPriv }));
      const verify = readMeta(code);
      isMe = verify?.authorityId === this.identity.playerId;
      if (isMe) metaLive = true;
    }
    if (!isMe) {
      if (incoming) this.routeActionFallback();
      return;
    }

    const fresh = readMeta(code)!;
    const model = loadModel(code);
    if (!model) return;

    // Keep the registry seeded so view-minting never misses a player whose
    // join envelope predates this tab's page load.
    this.syncSecrets();

    let changed = false;
    let mintedViews: IssuedView[] = [];
    if (incoming) {
      const res = applyAction(model, incoming);
      changed = res.changed || changed;
      if (res.views.length) mintedViews = res.views;
    }

    // presence sweep + tick
    changed = markPresence(model.pub, this.connectedIds()) || changed;
    if (tick(model)) changed = true;

    if (changed) {
      // Persist public + authority FIRST, then private views. Views are derived
      // from the same model, so a crash or handover between the two writes can
      // only leave views missing (recoverable via a re-deal), never newer-view
      // /older-public mismatches (which used to show a role card from a
      // different deal — unacceptable).
      lsSet(pubKey(code), JSON.stringify(model.pub));
      lsSet(metaKey(code), JSON.stringify({ authorityId: fresh.authorityId, hb: now, priv: scrambleJson(model.priv, code) }));
      this.handlers.onPublic(model.pub);
      this.channel?.postMessage({ type: "public", s: model.pub } satisfies ChannelMsg);
      if (mintedViews.length) this.writePrivateViews(mintedViews);
    } else {
      // keep the heartbeat fresh even when idle
      lsSet(metaKey(code), JSON.stringify({ authorityId: fresh.authorityId, hb: now, priv: scrambleJson(model.priv, code) }));
    }
  }

  /**
   * Safety net if NO tab currently owns the private bundle (e.g. only the
   * creator tab, which never writes meta until it loads the room page):
   * any client receiving actions but not finding a model writes lobby state
   * so the channel isn't a black hole. Rare — avoid overengineering here.
   */
  private routeActionFallback() {
    /* no-op: claim logic above covers the race; without a model there is
       nothing valid to apply anyway. */
  }

  private writePrivateViews(views: Array<{ playerId: string; secret: string; view: PrivateView }>) {
    for (const v of views) lsSet(pvKey(this.code, v.playerId), scrambleJson({ secret: v.secret, view: v.view }, this.code));
    this.channel?.postMessage({ type: "pvnudge" } satisfies ChannelMsg);
  }

  async getPrivateView(identity: RoomIdentity): Promise<PrivateView | null> {
    const raw = lsGet(pvKey(this.code, identity.playerId));
    if (!raw) return null;
    const rec = descrambleJson<{ secret: string; view: PrivateView } | null>(raw, this.code);
    if (!rec || rec.secret !== identity.secret) return null;
    return rec.view;
  }
}

export function createLocalRoomClient(code: string): LocalRoomClient {
  return new LocalRoomClient(code.toUpperCase());
}
