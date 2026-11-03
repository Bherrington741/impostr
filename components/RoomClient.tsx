"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Home, Users } from "lucide-react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import { LobbyScreen } from "@/components/screens/LobbyScreen";
import { RevealScreen } from "@/components/screens/RevealScreen";
import { DiscussionScreen } from "@/components/screens/DiscussionScreen";
import { VotingScreen } from "@/components/screens/VotingScreen";
import { LastChanceScreen } from "@/components/screens/LastChanceScreen";
import { ResultsScreen } from "@/components/screens/ResultsScreen";

export function RoomClient({ code: rawCode }: { code: string }) {
  const { code, identity, state, privateView: pv, me, send, load } = useRoom(rawCode);
  const [showRoster, setShowRoster] = useState(false);

  if (load === "connecting") {
    return <CenterDash title="Knocking on the door…" emoji="🚪" sub={`Looking for room ${code}`} spinner />;
  }
  if (load === "missing" || !state || !identity) {
    return (
      <CenterDash
        title="Room not found"
        emoji="🕳️"
        sub={`No room “${code}” here. It may have expired — head back and create your own.`}
        cta
      />
    );
  }

  const isHost = state.hostId === identity.playerId;
  const inRound = state.roster.includes(identity.playerId);
  const connectedCount = state.players.filter((p) => p.connected).length;
  const phase = state.phase;

  const screen =
    phase === "LOBBY" ? (
      <LobbyScreen state={state} me={me} isHost={isHost} myId={identity.playerId} send={send} />
    ) : phase === "ROLE_REVEAL" ? (
      <RevealScreen state={state} pv={pv} myId={identity.playerId} send={send} />
    ) : phase === "DISCUSSION" ? (
      <DiscussionScreen state={state} isHost={isHost} myId={identity.playerId} inRound={inRound} send={send} />
    ) : phase === "VOTING" ? (
      <VotingScreen state={state} myId={identity.playerId} inRound={inRound} send={send} />
    ) : phase === "IMPOSTER_LAST_CHANCE" ? (
      <LastChanceScreen state={state} pv={pv} myId={identity.playerId} inRound={inRound} send={send} />
    ) : (
      <ResultsScreen state={state} myId={identity.playerId} isHost={isHost} inRound={inRound} send={send} />
    );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur-md">
        <Link href="/" className="rounded-xl bg-white/5 p-2 text-slate-300" aria-label="Home">
          <Home className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Impostr · room</div>
          <div className="text-glow-white text-lg font-black leading-none tracking-[0.2em] text-white">{code}</div>
        </div>
        <button
          onClick={() => setShowRoster((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-black text-slate-300"
        >
          <Users className="h-4 w-4" /> {connectedCount}
        </button>
      </header>

      {showRoster && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden px-4 pt-3"
        >
          <div className="rounded-2xl bg-white/5 p-3 text-center text-[11px] font-bold text-slate-400">
            {state.players.map((p) => `${p.emoji} ${p.name}${p.id === identity.playerId ? " (you)" : ""}`).join("  ·  ")}
          </div>
        </motion.div>
      )}

      {/* phase content — remount keyed by phase. NOTE: no AnimatePresence exit-gate:
          background tabs throttle rAF, which would freeze an exit animation and
          leave the UI stuck on the previous phase forever, even though state
          is correct. Foreground enter animation still plays. */}
      <main className="flex-1 pt-4 safe-bottom">
        <motion.div
          key={`${phase}-${state.round}`}
          initial={{ opacity: 0, y: 26, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
        >
          {screen}
        </motion.div>
      </main>
    </div>
  );
}

function CenterDash({
  title,
  emoji,
  sub,
  spinner,
  cta,
}: {
  title: string;
  emoji: string;
  sub: string;
  spinner?: boolean;
  cta?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <motion.span
        animate={spinner ? { rotateY: [0, 360] } : { scale: [1, 1.1, 1] }}
        transition={spinner ? { repeat: Infinity, duration: 2.2 } : { repeat: Infinity, duration: 2 }}
        className="text-6xl"
      >
        {emoji}
      </motion.span>
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="text-sm font-bold text-slate-400">{sub}</p>
      {cta && (
        <Link href="/" className="mt-2 rounded-2xl bg-violet-500 px-6 py-3 font-black text-white glow-violet">
          Back to the party
        </Link>
      )}
    </div>
  );
}
