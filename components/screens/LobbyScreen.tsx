"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Check, Eraser, Pencil, Play, Send, Settings2, Sparkles, Timer, Trophy } from "lucide-react";
import { PlayerGrid } from "@/components/ui/PlayerGrid";
import { Press } from "@/components/ui/Press";
import { QrShare } from "@/components/ui/QrShare";
import { WORD_PACKS } from "@/lib/game/wordbank";
import { MIN_PLAYERS } from "@/lib/game/engine";
import type { Player, PublicState } from "@/lib/game/types";
import type { Action } from "@/lib/game/protocol";

const TIMERS = [1, 2, 3, 4, 5];

export function LobbyScreen({
  state,
  me,
  isHost,
  myId,
  send,
}: {
  state: PublicState;
  me: Player | null;
  isHost: boolean;
  myId: string;
  send: (a: Action) => void;
}) {
  const connected = state.players.filter((p) => p.connected);
  const canStart = connected.length >= MIN_PLAYERS;
  const showScores = state.round > 0 || Object.keys(state.scores).length > 0;
  const scoreboard = Object.entries(state.scores)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const customWords = !!state.settings.customWords;

  return (
    <div className="flex flex-col gap-4 px-4 pb-28">
      <QrShare code={state.code} />

      <section>
        <h3 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-lime-400" /> Crew ({connected.length})
        </h3>
        <PlayerGrid players={state.players} myId={myId} />
        {state.players.length < MIN_PLAYERS && (
          <p className="mt-2 text-center text-xs font-bold text-slate-500">
            Need at least {MIN_PLAYERS} players — invite {MIN_PLAYERS - state.players.length} more!
          </p>
        )}
      </section>

      {customWords && <WordPicker state={state} myId={myId} send={send} />}

      {showScores && scoreboard.length > 0 && (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-amber-300">
            <Trophy className="h-3.5 w-3.5" /> Session leaders
          </h3>
          <ul className="space-y-1.5">
            {scoreboard.map(([id, score], i) => (
              <li key={id} className="flex items-center gap-2 text-sm font-bold">
                <span className="text-amber-300">{["🥇", "🥈", "🥉"][i]}</span>
                <span className="text-slate-200">{state.players.find((p) => p.id === id)?.name ?? "Player"}</span>
                <span className="ml-auto tabular-nums text-amber-200">{score}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isHost ? (
        <HostControls state={state} canStart={canStart} send={send} />
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center text-sm font-bold text-slate-400">
          {me ? `You're in, ${me.name}. Waiting for the host to start…` : "Waiting for the host…"}
        </div>
      )}
    </div>
  );
}

function HostControls({ state, canStart, send }: { state: PublicState; canStart: boolean; send: (a: Action) => void }) {
  const customWords = !!state.settings.customWords;
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-lime-400/20 bg-lime-400/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-lime-300">
              <Pencil className="h-3.5 w-3.5" /> Player-picked words
            </h3>
            <p className="mt-1 text-[11px] font-bold leading-snug text-slate-500">
              Everyone drops a word; one is dealt at random.
            </p>
          </div>
          <ToggleChip
            active={customWords}
            onClick={() =>
              send({
                t: "updateSettings",
                packKey: state.settings.packKey,
                timerMinutes: state.settings.timerMinutes,
                customWords: !customWords,
              })
            }
          />
        </div>
        {customWords && (
          <p className="mt-3 rounded-xl bg-lime-400/10 px-3 py-2 text-[11px] font-bold text-lime-200/90">
            Word pack below is only the fallback if nobody submits.
          </p>
        )}
      </section>

      {!customWords && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
            <Settings2 className="h-3.5 w-3.5 text-violet-300" /> Word pack
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <PackChip
              label="🎲 All / Random"
              active={state.settings.packKey === "random"}
              onClick={() => send({ t: "updateSettings", packKey: "random", timerMinutes: state.settings.timerMinutes, customWords })}
            />
            {WORD_PACKS.map((p) => (
              <PackChip
                key={p.key}
                label={`${p.emoji} ${p.name}`}
                active={state.settings.packKey === p.key}
                onClick={() => send({ t: "updateSettings", packKey: p.key, timerMinutes: state.settings.timerMinutes, customWords })}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
          <Timer className="h-3.5 w-3.5 text-violet-300" /> Discussion timer
        </h3>
        <div className="flex gap-2">
          {TIMERS.map((m) => (
            <button
              key={m}
              onClick={() => send({ t: "updateSettings", packKey: state.settings.packKey, timerMinutes: m })}
              className={`flex-1 rounded-xl py-2.5 text-sm font-black transition-all ${
                state.settings.timerMinutes === m
                  ? "bg-violet-500 text-white glow-violet"
                  : "bg-white/5 text-slate-300"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </section>

      <Press
        variant="acid"
        size="lg"
        className={`w-full ${canStart ? "" : "cursor-not-allowed opacity-40"}`}
        onClick={() => canStart && send({ t: "start" })}
      >
        <Play className="h-6 w-6" /> START GAME
      </Press>
      {!canStart && (
        <p className="-mt-2 text-center text-xs font-bold text-rose-300">
          Needs at least {MIN_PLAYERS} players to deal
        </p>
      )}
    </div>
  );
}

function PackChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`rounded-xl px-3 py-2.5 text-xs font-black transition-all ${
        active ? "bg-lime-400 text-slate-950 glow-acid" : "bg-white/5 text-slate-300"
      }`}
    >
      {label}
    </motion.button>
  );
}

function ToggleChip({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition-all ${
        active ? "bg-lime-400 text-slate-950 glow-acid" : "bg-white/5 text-slate-400"
      }`}
    >
      {active ? "On" : "Off"}
    </motion.button>
  );
}

/**
 * Custom-word lobby card. Everyone (host included) secretly locks in a word;
 * the engine deals one of them at random. Only WHO submitted is public — the
 * words themselves never leave the private bundle.
 */
function WordPicker({ state, myId, send }: { state: PublicState; myId: string; send: (a: Action) => void }) {
  const [draft, setDraft] = useState("");
  const connected = state.players.filter((p) => p.connected);
  const submitted = state.wordSubmissions ?? [];
  const mine = submitted.includes(myId);

  const commit = () => {
    send({ t: "submitWord", word: draft });
    setDraft("");
  };

  return (
    <section className="rounded-3xl border border-lime-400/25 bg-lime-400/5 p-4">
      <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-lime-300">
        <Pencil className="h-3.5 w-3.5" /> Your secret word
      </h3>
      <p className="mt-1 text-[11px] font-bold leading-snug text-slate-500">
        One of the crew&apos;s words is dealt at random this round. Words stay sealed — even from the imposter… almost.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) commit();
          }}
          placeholder={mine ? "Locked in 🤫" : "e.g. Toaster"}
          maxLength={40}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-slate-900 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/30"
        />
        <Press variant="acid" className="shrink-0 !px-4" disabled={!draft.trim()} onClick={commit}>
          <Send className="h-4 w-4" />
        </Press>
      </div>

      {mine && (
        <button
          onClick={() => {
            send({ t: "submitWord", word: "" });
            setDraft("");
          }}
          className="mt-2 flex items-center gap-1.5 text-[11px] font-black text-lime-300/90"
        >
          <Eraser className="h-3 w-3" /> Clear my word
        </button>
      )}

      <p className="mt-3 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
        {submitted.length}/{connected.length} locked in
      </p>
      {submitted.length > 0 && (
        <p className="mt-1 truncate text-center text-[11px] font-bold text-slate-400">
          {submitted
            .map((id) => {
              const p = state.players.find((x) => x.id === id);
              return p ? `${p.emoji} ${p.id === myId ? "You" : p.name}` : null;
            })
            .filter(Boolean)
            .join("  ·  ")}
        </p>
      )}
      {submitted.length <= connected.length - 1 && connected.length >= MIN_PLAYERS && (
        <p className="mt-1 flex items-center justify-center gap-1 text-center text-[10px] font-bold text-slate-600">
          <Check className="h-3 w-3" /> Late submit? No worries — pack word is the fallback.
        </p>
      )}
    </section>
  );
}
