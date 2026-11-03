"use client";

import { motion } from "framer-motion";
import { ArrowRight, Crown, Eye, PartyPopper, Play, RotateCcw, Swords, Trophy } from "lucide-react";
import { Press } from "@/components/ui/Press";
import { SpectatorNote } from "@/components/screens/RevealScreen";
import type { PublicState, Winner } from "@/lib/game/types";
import type { Action } from "@/lib/game/protocol";

const WINNER_STYLES: Record<Winner, { title: string; sub: string; color: string; icon: React.ReactNode; glow: string }> = {
  CREW: {
    title: "CAUGHT!",
    sub: "The crew read the room perfectly.",
    color: "text-lime-400",
    icon: <PartyPopper className="h-12 w-12" />,
    glow: "glow-acid border-lime-400/50 bg-lime-400/10",
  },
  IMPOSTER_STEAL: {
    title: "STOLEN!",
    sub: "The imposter guessed the word and robbed everyone.",
    color: "text-pink-neon",
    icon: <Crown className="h-12 w-12" />,
    glow: "glow-pink border-pink-neon/50 bg-pink-neon/10",
  },
  IMPOSTER_ESCAPE: {
    title: "ESCAPED!",
    sub: "Votes scattered. The imposter walks free.",
    color: "text-violet-400",
    icon: <Swords className="h-12 w-12" />,
    glow: "glow-violet border-violet-400/50 bg-violet-500/10",
  },
};

/** RESULTS — full state is public here; dramatic reveal + scoreboards. */
export function ResultsScreen({
  state,
  myId,
  isHost,
  inRound,
  send,
}: {
  state: PublicState;
  myId: string;
  isHost: boolean;
  inRound: boolean;
  send: (a: Action) => void;
}) {
  if (!state.results) return <SpectatorNote state={state} />;
  const results = state.results;
  const style = WINNER_STYLES[results.winner];
  const imposter = state.players.find((p) => p.id === results.imposterId);
  const ordered = [...state.players].sort(
    (a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0),
  );

  return (
    <div className="flex flex-col gap-4 px-4 pb-28">
      {/* verdict banner */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotate: -2 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className={`rounded-3xl border-2 p-6 text-center ${style.glow}`}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="mx-auto mb-2 w-fit"
          style={{ color: style.color }}
        >
          {style.icon}
        </motion.div>
        <h2 className={`text-glow-white text-5xl font-black tracking-tight ${style.color}`}>{style.title}</h2>
        <p className="mt-1 text-sm font-bold text-slate-300">{style.sub}</p>
      </motion.div>

      {/* imposter + word reveal */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-3xl border border-white/10 bg-white/5 p-5"
      >
        <div className="flex items-center gap-4">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 14 }}
            className="text-5xl"
          >
            {imposter?.emoji ?? "🕶️"}
          </motion.span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">
              <Eye className="h-3 w-3" /> The imposter was
            </div>
            <div className="truncate text-2xl font-black">{imposter?.name ?? "???"}</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-slate-900/80 p-4 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Secret word — {results.category}
          </div>
          <div className="text-glow-white mt-1 text-3xl font-black text-white">{results.secretWord}</div>
          <div className="mt-1 text-[11px] font-bold italic text-slate-500">{results.categoryHint}</div>
        </div>
        {results.winner === "IMPOSTER_STEAL" && results.stealAttempt && (
          <p className="mt-3 text-center text-xs font-black text-pink-neon">
            Steal guess: “{results.stealAttempt}” — dead on. 💀
          </p>
        )}
        {results.winner === "CREW" && results.stealAttempt && (
          <p className="mt-3 text-center text-xs font-black text-lime-400">
            Steal guess: “{results.stealAttempt}” — wrong. Nice try.
          </p>
        )}
      </motion.section>

      {/* vote breakdown */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-3xl border border-white/10 bg-white/5 p-5"
      >
        <h3 className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
          Who voted for whom
        </h3>
        <ul className="flex flex-col gap-2">
          {Object.entries(results.votes).map(([voterId, targetId], i) => {
            const voter = state.players.find((p) => p.id === voterId);
            const target = state.players.find((p) => p.id === targetId);
            const correct = targetId === results.imposterId;
            if (!voter) return null;
            return (
              <motion.li
                key={voterId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.06 }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold ${
                  correct ? "bg-lime-400/10 text-lime-200 ring-1 ring-lime-400/40" : "bg-white/5 text-slate-300"
                }`}
              >
                <span className="text-xl">{voter.emoji}</span>
                <span className="truncate">{voter.name}</span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
                <span className="truncate">{target?.name ?? "—"}</span>
                {correct && <span className="ml-auto text-[10px] font-black text-lime-400">+1</span>}
              </motion.li>
            );
          })}
          {Object.keys(results.votes).length === 0 && (
            <li className="text-center text-xs font-bold text-slate-500">Nobody voted — chaotic.</li>
          )}
        </ul>
      </motion.section>

      {/* scoreboard */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5"
      >
        <h3 className="mb-3 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-amber-300">
          <Trophy className="h-3.5 w-3.5" /> Session scores
        </h3>
        <ul className="flex flex-col gap-1.5">
          {ordered.map((p, i) => {
            const score = state.scores[p.id] ?? 0;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${
                  p.id === myId ? "bg-violet-500/10 text-violet-100" : "text-slate-300"
                }`}
              >
                <span className="w-5 text-center text-xs text-slate-500">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                <span>{p.emoji}</span>
                <span className="truncate">{p.name}</span>
                <span className="ml-auto tabular-nums">{score}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-center text-[10px] font-bold text-slate-500">
          +1 per correct catch · +2 steal win · +3 perfect escape
        </p>
      </motion.section>

      {isHost ? (
        <Press variant="acid" size="lg" className="w-full" onClick={() => send({ t: "playAgain" })}>
          <Play className="h-6 w-6" /> PLAY AGAIN — NEW WORD, NEW IMPOSTER
        </Press>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-400">
          <RotateCcw className="h-4 w-4 animate-spin" style={{ animationDuration: "2.5s" }} />
          Waiting for the host to deal the next round…
        </div>
      )}
    </div>
  );
}
