/**
 * SUPABASE BACKEND — server-authoritative.
 *
 * Architecture:
 *  - The ENGINE runs inside Next.js API routes (never in the browser).
 *  - Public state is stored in Postgres (`rooms.public_state`); players receive
 *    updates via Supabase Realtime (postgres_changes) with a polling fallback.
 *  - The PrivateBundle lives in `room_state_private` (NO client policies), and
 *    per-player private views in `room_views`. Views are only ever served by
 *    the private-view API route after re-verifying the player's identity secret.
 *  - Presence is maintained by a lightweight per-room channel presence track
 *    plus heartbeats through the action route.
 */
import type { Action } from "@/lib/game/protocol";
import { makeEnvelope } from "@/lib/game/protocol";
import type { PrivateView, PublicState } from "@/lib/game/types";
import type { RoomIdentity } from "@/lib/game/identity";
import type { RoomClient, RoomClientHandlers } from "./types";

function anonClient() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { realtime: { params: { eventsPerSecond: 20 } } },
  );
}

const api = (path: string) => `/api/rooms${path}`;

export class SupabaseRoomClient implements RoomClient {
  kind = "supabase" as const;
  private code: string;
  private identity!: RoomIdentity;
  private handlers!: RoomClientHandlers;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private client: ReturnType<typeof anonClient> | null = null;
  private unsub: (() => void) | null = null;

  constructor(code: string) {
    this.code = code.toUpperCase();
  }

  async connect(identity: RoomIdentity, handlers: RoomClientHandlers) {
    this.identity = identity;
    this.handlers = handlers;
    this.send({ t: "join", player: { id: identity.playerId, name: identity.name, emoji: identity.emoji } });

    this.pollTimer = setInterval(async () => {
      try {
        const res = await fetch(api(`/${this.code}`), { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { state: PublicState | null };
        if (json.state) handlers.onPublic(json.state);
      } catch {
        /* offline: keep last state */
      }
    }, 2500);

    this.pingTimer = setInterval(
      () => this.send({ t: "ping" }),
      4000,
    );

    try {
      this.client = anonClient();
      const channel = this.client.channel(`room:${this.code}`);
      // Realtime typing across supabase-js minors is fussy; thread through a
      // narrowly-typed local alias instead of `any`.
      type PgChange = { new: { public_state: PublicState } };
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rooms", filter: `code=eq.${this.code}` } as never,
          (payload: unknown) => {
            const p = payload as PgChange;
            if (p?.new?.public_state) handlers.onPublic(p.new.public_state);
          },
        )
        .on("broadcast", { event: "pvnudge" }, () => handlers.onPrivateInvalidated())
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            channel.track({ playerId: identity.playerId });
            void this.fetchPublic();
          }
        });
      this.unsub = () => {
        this.client?.removeChannel(channel);
      };
    } catch {
      // Realtime not available — polling fallback above still works.
    }
  }

  private async fetchPublic() {
    try {
      const res = await fetch(api(`/${this.code}`), { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { state: PublicState | null };
      if (json.state) this.handlers.onPublic(json.state);
    } catch {
      /* ignore */
    }
  }

  destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.unsub?.();
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
    }).catch(() => {});
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
