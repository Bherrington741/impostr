"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Vote } from "lucide-react";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { Press } from "@/components/ui/Press";
import { TimerRing } from "@/components/ui/TimerRing";
import { SpectatorNote } from "@/components/screens/RevealScreen";
import type { Player, PublicState } from "@/lib/game/types";
import type { Action } from "@/lib/game/protocol";

/** VOTING — targets hidden, voters' checkmarks public. */
export function VotingScreen({
  state,
  myId,
  inRound,
  send,
}: {
  state: PublicState;
  myId: string;
  inRound: boolean;
  send: (a: Action) => void;
}) {
  const [confirmTarget, setConfirmTarget] = useState<Player | null>(null);
  if (!inRound) return <SpectatorNote state={state} />;

  const voted = state.hasVoted.includes(myId);
  const roster = state.players.filter((p) => state.roster.includes(p.id) && p.connected);
  const targets = roster.filter((p) => p.id !== myId);
  const voters = roster.filter((p) => p.id !== myId);

  return (
    <div className="flex flex-col gap-5 px-4 pb-24">
      <TimerRing endTime={state.endTime} totalMs={60_000} />

      <div className="text-center">
        <h2 className="text-glow-white text-2xl font-black text-white">Who is the Imposter?</h2>
        <p className="mt-1 text-xs font-bold text-slate-400">
          Votes stay hidden until everyone locks in
        </p>
      </div>

      {!voted ? (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            {targets.map((p) => (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.93 }}
                onClick={() => setConfirmTarget(p)}
                className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-3 text-center transition-colors active:border-pink-neon/70 active:bg-pink-neon/10"
              >
                <span className="text-3xl">{p.emoji}</span>
                <span className="max-w-[12ch] truncate text-[11px] font-black">{p.name}</span>
              </motion.button>
            ))}
          </div>
          {targets.length === 0 && (
            <p className="text-center text-sm font-bold text-slate-400">You&apos;re the last one — everyone left!</p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-pink-neon/30 bg-pink-neon/10 p-6 text-center glow-pink">
          <CheckCircle2 className="h-10 w-10 text-pink-neon" />
          <p className="text-lg font-black">Vote locked</p>
          <p className="text-xs font-bold text-pink-200/80">Waiting for the rest of the crew…</p>
        </div>
      )}

      {/* live "has voted" indicators — who they voted for is never shown here */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
          Ballot box {state.hasVoted.length}/{roster.length}
        </div>
        <div className="text-center">
          <PlayerGrid
            players={roster}
            myId={myId}
            badgeFor={(p) =>
              state.hasVoted.includes(p.id) ? (
                <motion.span
                  initial={{ scale: 0, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-neon text-slate-950 glow-pink"
                >
                  <Vote className="h-3.5 w-3.5" />
                </motion.span>
              ) : null
            }
          />
        </div>
        {voters.length > 0 && state.hasVoted.length < voters.length && (
          <p className="mt-3 text-center text-[11px] font-bold text-slate-500">
            {voters.length - state.hasVoted.length} still deciding
          </p>
        )}
      </section>

      {/* confirm sheet */}
      <AnimatePresence>
        {confirmTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmTarget(null)}
          >
            <motion.div
              className="w-full max-w-md rounded-t-3xl border-t border-white/15 bg-slate-900 p-6 pb-10"
              initial={{ y: 320 }}
              animate={{ y: 0 }}
              exit={{ y: 320 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-center gap-3">
                <span className="text-4xl">{confirmTarget.emoji}</span>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Lock in vote</div>
                  <div className="text-xl font-black">{confirmTarget.name}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <Press
                  variant="pink"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    send({ t: "castVote", targetId: confirmTarget.id });
                    setConfirmTarget(null);
                  }}
                >
                  <Vote className="h-5 w-5" /> Yes — vote {confirmTarget.name} <ArrowRight className="h-4 w-4" />
                </Press>
                <Press variant="ghost" size="lg" className="w-full" onClick={() => setConfirmTarget(null)}>
                  Cancel
                </Press>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
