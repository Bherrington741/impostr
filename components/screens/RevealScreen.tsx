"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ghost, Lock, ShieldCheck } from "lucide-react";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { Press } from "@/components/ui/Press";
import type { PrivateView, PublicState } from "@/lib/game/types";
import type { Action } from "@/lib/game/protocol";

/**
 * ROLE_REVEAL — private, hold-to-reveal card (anti shoulder-surf).
 * The card's true contents are ONLY known here via the per-player
 * private view; nothing about roles exists in the broadcast state.
 */
export function RevealScreen({
  state,
  pv,
  myId,
  send,
}: {
  state: PublicState;
  pv: PrivateView | null;
  myId: string;
  send: (a: Action) => void;
}) {
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imposter = pv?.role === "IMPOSTER";
  const isReady = state.ready.includes(myId);

  useEffect(() => {
    setRevealed(false);
    setRevealing(false);
  }, [state.round]);

  function startHold() {
    if (isReady) return;
    setRevealing(true);
    holdTimer.current = setTimeout(() => setRevealed(true), 550);
  }
  function endHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    // Once revealed, keep it; otherwise reset.
    setRevealing(false);
  }

  if (!pv) {
    return (
      <SpectatorNote state={state} />
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-24">
      <div className="h-52 select-none sm:h-60">
        <motion.div
          className="mx-auto h-full max-w-xs cursor-pointer [perspective:1200px]"
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          <motion.div
            className="relative h-full w-full rounded-3xl [transform-style:preserve-3d]"
            animate={{ rotateY: revealed ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
          >
            {/*_FRONT */}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 [backface-visibility:hidden]
                ${imposter
                  ? "border-rose-500/60 bg-gradient-to-b from-rose-950/60 to-slate-950 glow-red"
                  : "border-lime-400/50 bg-gradient-to-b from-lime-950/40 to-slate-950 glow-acid"}`}
            >
              {imposter ? <Ghost className="h-14 w-14 text-rose-400" /> : <ShieldCheck className="h-14 w-14 text-lime-400" />}
              <div className="px-6 text-center text-lg font-black text-slate-300">
                Hold to reveal your part
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                <Lock className="h-3 w-3" /> nobody else can see this screen
              </div>
            </div>

            {/* BACK — the secret */}
            <div
              className={`absolute inset-0 flex [backface-visibility:hidden] [transform:rotateY(180deg)]
                rounded-3xl border-2 p-5 ${
                  imposter
                    ? "border-rose-500 bg-gradient-to-b from-rose-900/50 to-rose-950/80 glow-red"
                    : "border-lime-400 bg-gradient-to-b from-lime-900/40 to-lime-950/80 glow-acid"
                }`}
            >
              <div className="flex w-full flex-col items-center justify-center gap-2 text-center">
                <AnimatePresence mode="wait">
                  {revealed && (
                    <motion.div
                      key="reveal"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-2"
                    >
                      {imposter ? (
                        <>
                          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-rose-300">Your role</span>
                          <span className="text-glow-white text-4xl font-black tracking-widest text-rose-400">
                            IMPOSTER
                          </span>
                          <span className="mt-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-rose-200">
                            Category hint: {pv.category}
                          </span>
                          <span className="mt-1 px-2 text-2xl font-black text-white">
                            ??? 
                          </span>
                          <span className="text-xs font-bold italic text-rose-200/80">
                            Blend in… then steal it.
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-lime-300">Your role</span>
                          <span className="text-xl font-black tracking-widest text-lime-300">CREWMATE</span>
                          <span className="mt-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-lime-100">
                            {pv.category}
                          </span>
                          <span className="text-glow-white mt-1 px-2 text-3xl font-black text-white">
                            {pv.secretWord}
                          </span>
                          <span className="text-xs font-bold italic text-lime-200/70">
                            Don&apos;t say it out loud!
                          </span>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {!revealed ? (
        <p className="text-center text-xs font-bold text-slate-500">
          👆 Press &amp; hold the card, look around first — make sure no one&apos;s peeking
        </p>
      ) : (
        <Press
          variant={imposter ? "danger" : "acid"}
          size="lg"
          className="w-full"
          disabled={isReady}
          onClick={() => send({ t: "ready" })}
        >
          {isReady ? "Locked in ✔" : "Got it — I'm ready"}
        </Press>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
          <span>Locked in</span>
          <span>
            {state.ready.filter((r) => state.roster.includes(r)).length}/{state.roster.length}
          </span>
        </div>
        <div className="mt-3">
          <PlayerGrid
            players={state.players.filter((p) => state.roster.includes(p.id))}
            myId={myId}
            badgeFor={(p) =>
              state.ready.includes(p.id) ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-400 text-[11px] font-black text-slate-950 glow-acid">
                  ✓
                </span>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  );
}

export function SpectatorNote({ state }: { state: PublicState }) {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-8 text-center">
      <motion.span
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2.4 }}
        className="text-6xl"
      >
        🍿
      </motion.span>
      <h2 className="text-2xl font-black">Round in progress</h2>
      <p className="text-sm font-bold text-slate-400">
        You joined mid-round — the next deal after results will bring you in.
      </p>
    </div>
  );
}
