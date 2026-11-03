"use client";

import { motion } from "framer-motion";
import { Crown, Wifi, WifiOff } from "lucide-react";
import type { Player } from "@/lib/game/types";

export function PlayerChip({
  player,
  isMe,
  badge,
  dimmed,
  index = 0,
}: {
  player: Player;
  isMe?: boolean;
  badge?: React.ReactNode;
  dimmed?: boolean;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{ type: "spring", stiffness: 400, damping: 22, delay: index * 0.03 }}
      className={`relative flex flex-col items-center gap-1 rounded-3xl border p-3 text-center
        ${dimmed ? "opacity-40" : ""}
        ${isMe ? "border-violet-400/70 bg-violet-500/10" : "border-white/10 bg-white/5"}`}
    >
      {player.isHost && (
        <Crown className="absolute -top-2 -right-2 h-5 w-5 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      )}
      <span className="text-3xl leading-none">{player.emoji}</span>
      <span className="max-w-[15ch] truncate text-[11px] font-bold leading-tight text-slate-200">
        {player.name}
      </span>
      <span className={`flex items-center gap-0.5 text-[9px] ${player.connected ? "text-lime-400" : "text-slate-500"}`}>
        {player.connected ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
        {isMe ? "YOU" : player.connected ? "HERE" : "OFF"}
      </span>
      {badge !== undefined && <div className="absolute -bottom-2 -right-1.5">{badge}</div>}
    </motion.div>
  );
}

export function PlayerGrid({
  players,
  myId,
  badgeFor,
  dimAll,
}: {
  players: Player[];
  myId?: string;
  badgeFor?: (p: Player) => React.ReactNode;
  dimAll?: boolean;
}) {
  const cols = players.length <= 4 ? 2 : players.length <= 9 ? 3 : 4;
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {players.map((p, i) => (
        <PlayerChip
          key={p.id}
          player={p}
          isMe={p.id === myId}
          index={i}
          dimmed={dimAll ? p.id !== myId : !p.connected}
          badge={badgeFor?.(p)}
        />
      ))}
    </div>
  );
}
