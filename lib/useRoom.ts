"use client";

/**
 * useRoom — one hook per browser tab.
 * Owns identity, transport lifecycle, public state subscription, presence
 * and per-player private view fetching (anti-cheat: views are requested
 * with this tab's identity secret only).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRoomIdentity, loadProfile, type RoomIdentity } from "@/lib/game/identity";
import { createRoomClient } from "@/lib/realtime";
import type { RoomClient, RoomClientHandlers } from "@/lib/realtime/types";
import type { PrivateView, PublicState } from "@/lib/game/types";
import type { Action } from "@/lib/game/protocol";

export type RoomLoadState = "connecting" | "ready" | "missing";

/** Phases where a player is allowed to know their own role. */
const PRIVATE_VIEW_PHASES: ReadonlySet<PublicState["phase"]> = new Set(["ROLE_REVEAL", "IMPOSTER_LAST_CHANCE"]);

export function useRoom(codeRaw: string, ready = true) {
  const code = useMemo(() => codeRaw.toUpperCase(), [codeRaw]);
  const [identity, setIdentity] = useState<RoomIdentity | null>(null);
  const [state, setState] = useState<PublicState | null>(null);
  const [privateView, setPrivateView] = useState<PrivateView | null>(null);
  const [pvVersion, setPvVersion] = useState(0);
  const [load, setLoad] = useState<RoomLoadState>("connecting");
  const clientRef = useRef<RoomClient | null>(null);
  const stateRef = useRef<PublicState | null>(null);

  stateRef.current = state;

  // 0) Optionally wait for the caller (e.g. a name gate) before touching
  //    identity/storage — we must not mint a Guest identity first.
  // 1) Stable per-tab identity (refresh-safe via sessionStorage).
  useEffect(() => {
    if (!ready) return;
    setIdentity(getRoomIdentity(code, loadProfile()));
  }, [code, ready]);

  // 2) Transport lifecycle.
  useEffect(() => {
    if (!identity) return;
    const client = createRoomClient(code);
    clientRef.current = client;
    const handlers: RoomClientHandlers = {
      onPublic: (s) => {
        setState(s);
        setLoad("ready");
      },
      onPrivateInvalidated: () => setPvVersion((v) => v + 1),
    };
    client.connect(identity, handlers);
    return () => {
      client.destroy();
      clientRef.current = null;
    };
    // identity is intentionally NOT a dependency: it is created once per tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, identity?.playerId]);

  // 3) Detect "room not found" quickly for a great join-error UX.
  useEffect(() => {
    if (!ready || load !== "connecting") return;
    const timer = setTimeout(() => {
      if (!stateRef.current) setLoad("missing");
    }, 3500);
    return () => clearTimeout(timer);
  }, [ready, load]);

  // 4) Fetch my private view when it becomes relevant.
  const phase = state?.phase ?? null;
  const round = state?.round ?? 0;
  useEffect(() => {
    if (!identity || !phase) return;
    if (!PRIVATE_VIEW_PHASES.has(phase)) {
      if (privateView) setPrivateView(null);
      return;
    }
    let cancelled = false;
    void clientRef.current?.getPrivateView(identity).then((view) => {
      if (!cancelled) {
        // Defense-in-depth: a shard minted from a DIFFERENT deal (local-mode
        // authority handover race) may carry a stale round number, or same
        // round but a mismatched category. Never surface it.
        const cur = stateRef.current;
        const ok = view && view.round === round && view.category === (cur?.category ?? null);
        setPrivateView(ok ? view : null);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, phase, round, pvVersion]);

  // 5) Forget the view when roles could have rotated.
  useEffect(() => {
    setPrivateView(null);
  }, [round]);

  const send = useCallback((action: Action) => {
    clientRef.current?.send(action);
  }, []);

  const me = useMemo(
    () => state?.players.find((p) => p.id === identity?.playerId) ?? null,
    [state, identity],
  );

  return { code, identity, state, privateView, me, send, load };
}
