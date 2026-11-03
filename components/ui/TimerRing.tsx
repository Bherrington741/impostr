"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Phase } from "@/lib/game/types";

/** Synchronized countdown ring driven by the room's authoritative deadline. */
export function TimerRing({
  endTime,
  totalMs,
  urgent,
}: {
  endTime: number | null;
  totalMs: number;
  urgent?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remainingMs = endTime ? Math.max(0, endTime - now) : totalMs;
  const progress = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60));
  const ss = String(totalSec % 60).padStart(2, "0");
  const critical = remainingMs <= 10_000 && remainingMs > 0;

  const stroke = urgent ? "#f43f5e" : critical ? "#fb7185" : "#a3e635";
  const r = 86;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <motion.circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ * (1 - progress) }}
          transition={{ duration: 0.3, ease: "linear" }}
          style={{ filter: `drop-shadow(0 0 10px ${stroke})` }}
        />
      </svg>
      <div className="text-center">
        <div
          className={`text-glow-white text-6xl font-black tabular-nums ${critical ? "animate-pulse" : ""}`}
          style={{ color: stroke }}
        >
          {mm}:{ss}
        </div>
        {urgent && <div className="mt-1 text-[11px] font-black tracking-[0.3em] text-rose-300">FINAL ANSWER</div>}
      </div>
    </div>
  );
}

export function endTimeOf(phase: Phase, endTime: number | null, fallbackMs: number) {
  void phase;
  return { endTime, fallbackMs };
}
