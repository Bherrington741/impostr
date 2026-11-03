/**
 * SERVER BACKEND — server-authoritative, no database.
 *
 * Architecture:
 *  - The engine runs inside Next.js API routes; rooms live in server memory.
 *  - Clients poll `GET /api/rooms/:code` for public state (tiny JSON blobs,
 *    cheap). Acting devices get an INSTANT refetch: the action route returns
 *    `changed: true`, which triggers an immediate poll.
 *  - Private views are fetched from the private-view route only, after the
 *    server re-verifies this tab's identity secret.
 *  - When the round/phase changes, private views are re-minted server-side —
 *    fire onPrivateInvalidated so the hook refetches.
 */
import type { Action } from "@/lib/game/protocol";
import { makeEnvelope } from "@/lib/game/protocol";
import type { PrivateView, PublicState } from "@/lib/game/types";
import type { RoomIdentity } from "@/lib/game/identity";
import type { RoomClient, RoomClientHandlers } from "./types";

const api = (path: string) => `/api/rooms${path}`;

export class PollRoomClient implements RoomClient {
  kind = "server" as const;
  private code: string;
  private identity!: RoomIdentity;
  private handlers!: RoomClientHandlers;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  /** `${round}:${phase}` of the last public state we delivered. */
  private lastSig = "";

  constructor(code: string) {
    this.code = code.toUpperCase();
  }

  connect(identity: RoomIdentity, handlers: RoomClientHandlers) {
    this.identity = identity;
    this.handlers = handlers;

    // Announce + fetch immediately so the first paint is fast.
    this.send({ t: "join", player: { id: identity.playerId, name: identity.name, emoji: identity.emoji } });
    void this.fetchPublic();

    this.pollTimer = setInterval(() => void this.fetchPublic(), 2000);
    this.pingTimer = setInterval(() => this.send({ t: "ping" }), 4000);
  }

  private async fetchPublic(): Promise<void> {
    try {
      const res = await fetch(api(`/${this.code}`), { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { state: PublicState | null };
      if (!json.state) return;
      const sig = `${json.state.round}:${json.state.phase}`;
      // round/phase change ⇒ role views may have been re-minted (deal, Play Again…)
      if (this.lastSig && sig !== this.lastSig) this.handlers.onPrivateInvalidated();
      this.lastSig = sig;
      this.handlers.onPublic(json.state);
    } catch {
      /* offline: keep last state */
    }
  }

  destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
  }

  send(action: Action) {
    // NOTE: ping intentionally sends a fresh envelope id so heartbeats are
    // never de-duplicated against each other.
    const env = makeEnvelope(this.identity.playerId, this.identity.secret, action);
    void fetch(api(`/${this.code}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(env),
      keepalive: action.t === "ping",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { changed?: boolean } | null) => {
        // The acting device (and everyone, on timer ticks) refetches at once —
        // no need to wait for the next 2s poll.
        if (json?.changed) void this.fetchPublic();
      })
      .catch(() => {});
  }

  async getPrivateView(identity: RoomIdentity): Promise<PrivateView | null> {
    try {
      const url = new URL(api(`/${this.code}/private`), window.location.origin);
      url.searchParams.set("playerId", identity.playerId);
      url.searchParams.set("secret", identity.secret);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return null;
      const json = (await res.json()) as { view: PrivateView | null };
      return json.view;
    } catch {
      return null;
    }
  }
}
