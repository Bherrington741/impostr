"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Hourglass } from "lucide-react";
import { Press } from "@/components/ui/Press";
import { TimerRing } from "@/components/ui/TimerRing";
import { SpectatorNote } from "@/components/screens/RevealScreen";
import { guessEmoji } from "@/lib/game/identity";
import type { PrivateView, PublicState } from "@/lib/game/types";
import type { Action } from "@/lib/game/protocol";

/** IMPOSTER_LAST_CHANCE — 15s steal window. Only the imposter's device knows it's theirs. */
export function LastChanceScreen({
  state,
  pv,
  myId,
  inRound,
  send,
}: {
  state: PublicState;
  pv: PrivateView | null;
  myId: string;
  inRound: boolean;
  send: (a: Action) => void;
}) {
  const [guess, setGuess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pv?.role === "IMPOSTER") inputRef.current?.focus();
  }, [pv?.role]);

  if (!inRound) return <SpectatorNote state={state} />;

  const isImposter = pv?.role === "IMPOSTER";

  return isImposter ? (
    <div className="flex flex-col gap-5 px-4 pb-24">
      <TimerRing endTime={state.endTime} totalMs={15_000} urgent />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-3xl border border-rose-500/60 bg-rose-950/40 p-5 text-center glow-red"
      >
        <Flame className="mx-auto mb-2 h-9 w-9 text-rose-400" />
        <h2 className="text-2xl font-black text-rose-400">You were caught!</h2>
        <p className="mt-1 text-sm font-bold text-rose-200/90">
          One shot: name the Secret Word to steal the win.
        </p>
      </motion.div>

      <input
        ref={inputRef}
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        placeholder="Type the secret word…"
        maxLength={40}
        autoComplete="off"
        className="w-full rounded-2xl border border-white/15 bg-slate-900 px-5 py-4 text-center text-xl font-black tracking-wide text-white placeholder:text-slate-600 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
      />

      {state.decoys.length > 0 && (
        <div>
          <p className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">
            Or pick a trap from <span className="text-rose-400">{state.category}</span>
          </p>
          <div className="grid grid-cols-1 gap-2">
            {state.decoys.map((d) => (
              <Press
                key={d}
                variant="danger"
                className="w-full text-lg"
                onClick={() => send({ t: "stealGuess", word: d })}
              >
                {guessEmoji(d)} {d}
              </Press>
            ))}
          </div>
        </div>
      )}

      <Press
        variant="pink"
        size="lg"
        className="w-full"
        disabled={guess.trim().length === 0}
        onClick={() => send({ t: "stealGuess", word: guess.trim() })}
      >
        <Flame className="h-5 w-5" /> Steal it
      </Press>
    </div>
  ) : (
    <div className="flex h-[75vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <TimerRing endTime={state.endTime} totalMs={15_000} urgent />
      <motion.div
        animate={{ opacity: [1, 0.55, 1] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="flex items-center gap-2 text-lg font-black text-rose-300"
      >
        <Hourglass className="h-5 w-5" /> Don&apos;t say a word
      </motion.div>
      <p className="text-sm font-bold text-slate-400">
        The crew caught the imposter — but there&apos;s a 15-second steal window. Breathe.
      </p>
    </div>
  );
}
