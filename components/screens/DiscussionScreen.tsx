"use client";

import { motion } from "framer-motion";
import { FastForward, MessageCircleHeart, Star } from "lucide-react";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { Press } from "@/components/ui/Press";
import { TimerRing } from "@/components/ui/TimerRing";
import type { PublicState } from "@/lib/game/types";
import type { Action } from "@/lib/game/protocol";
import { SpectatorNote } from "@/components/screens/RevealScreen";

export const VOTE_SECONDS = 60;

/** DISCUSSION — synchronized countdown + speaking order, first speaker highlighted. */
export function DiscussionScreen({
  state,
  isHost,
  myId,
  inRound,
  send,
}: {
  state: PublicState;
  isHost: boolean;
  myId: string;
  inRound: boolean;
  send: (a: Action) => void;
}) {
  if (!inRound) return <SpectatorNote state={state} />;

  return (
    <div className="flex flex-col gap-5 px-4 pb-24">
      <TimerRing endTime={state.endTime} totalMs={state.settings.timerMinutes * 60_000} />

      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="rounded-full bg-violet-500/15 px-4 py-1 text-xs font-black tracking-[0.2em] text-violet-300">
          {state.category?.toUpperCase()}
        </span>
        <p className="mt-1 flex items-center gap-1.5 px-6 text-sm font-bold text-slate-300">
          <MessageCircleHeart className="h-4 w-4 shrink-0 text-pink-neon" />
          Give one-word clues. Catch the liar.
        </p>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
          Speaking order
        </h3>
        <div className="flex flex-col gap-2">
          {state.speakingOrder.map((id, i) => {
            const player = state.players.find((p) => p.id === id);
            if (!player) return null;
            const isFirst = i === 0;
            const isMe = id === myId;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${
                  isFirst
                    ? "bg-pink-neon/15 text-white ring-1 ring-pink-neon/50 glow-pink"
                    : isMe
                      ? "bg-violet-500/10 text-violet-100 ring-1 ring-violet-400/40"
                      : "bg-white/5 text-slate-300"
                }`}
              >
                <span className={`text-lg ${isFirst ? "animate-bounce" : ""}`}>{player.emoji}</span>
                <span className="text-sm font-black">{isFirst && <Star className="mr-1 -mt-1 inline h-4 w-4 text-amber-300" />}{player.name}</span>
                <span className="ml-auto text-[10px] font-bold tabular-nums text-slate-500">#{i + 1}</span>
              </motion.div>
            );
          })}
        </div>
      </section>

      {isHost && (
        <Press variant="pink" className="w-full" onClick={() => send({ t: "skipToVoting" })}>
          <FastForward className="h-5 w-5" /> Skip to Voting
        </Press>
      )}

      <div className="text-center">
        <PlayerGrid players={state.players.filter((p) => state.roster.includes(p.id))} myId={myId} />
      </div>
    </div>
  );
}
