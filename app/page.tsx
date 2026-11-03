"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Dices, DoorOpen, Drama, Play, UserRound } from "lucide-react";
import { AVATARS, getRoomIdentity, guessEmoji, loadProfile, saveProfile } from "@/lib/game/identity";
import { generateRoomCode } from "@/lib/game/engine";
import { ensureLocalRoom, localRoomExists } from "@/lib/realtime";
import { backendKind } from "@/lib/realtime";
import { Press } from "@/components/ui/Press";

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ name: string; emoji: string } | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("👽");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const backend = useMemo(() => backendKind(), []);
  const hydrated = useRef(false);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    setName(p?.name ?? "");
    setEmoji(p?.emoji ?? "👽");
    setProfileReady(true);
    hydrated.current = true;

    // deep link: /?join=CODE
    const params = new URLSearchParams(window.location.search);
    const j = params.get("join");
    if (j) setJoinCode(j.toUpperCase());
  }, []);

  function commitProfile(): { name: string; emoji: string } {
    const clean = {
      name: (name || `Guest ${Math.floor(100 + Math.random() * 900)}`).trim().slice(0, 18),
      emoji: emoji || guessEmoji(name),
    };
    saveProfile(clean);
    setProfile(clean);
    return clean;
  }

  function handleCreate() {
    if (busy) return;
    setBusy("create");
    setError(null);
    const clean = commitProfile();
    const host = getRoomIdentity("NEW", clean); // temp identity for name; real one generated per code
    void host;
    const code = generateRoomCode();
    const identity = getRoomIdentity(code, clean);
    if (backend === "local") {
      ensureLocalRoom(code, identity, { packKey: "random", timerMinutes: 3 });
      router.push(`/room/${code}`);
    } else {
      void createRemoteRoom(code, identity, clean, router, () => setBusy(null));
    }
  }

  function handleJoin() {
    if (busy) return;
    const code = joinCode.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    if (code.length !== 4) {
      setError("Room codes are 4 letters — ask your host!");
      return;
    }
    setBusy("join");
    setError(null);
    commitProfile();
    if (backend === "local") {
      if (!localRoomExists(code)) {
        setBusy(null);
        setError(`No room “${code}” open in this browser. Create one, or open the room's exact link/QR from the host.`);
        return;
      }
      router.push(`/room/${code}`);
    } else {
      const clean = (profile ?? { name: name.trim() || "Guest", emoji });
      const identity = getRoomIdentity(code, clean);
      void fetch(`/api/rooms/${code}`, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error("not found");
          router.push(`/room/${code}`);
        })
        .catch(() => {
          setBusy(null);
          setError(`Room “${code}” doesn't exist.`);
        });
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-16 pt-14 safe-bottom">
      {/* hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: [-6, 6, -6] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl border border-pink-neon/40 bg-gradient-to-b from-violet-500/20 to-slate-950 glow-pink"
        >
          <Drama className="h-12 w-12 text-pink-neon" />
        </motion.div>
        <h1 className="text-glow-white text-6xl font-black tracking-tight text-white">IMPOSTR</h1>
        <p className="mt-2 text-sm font-bold text-slate-400">
          One secret word. One liar on your couch.
          <br />
          Whoever smells the rat, wins.
        </p>
      </motion.div>

      {/* nickname gate / menu */}
      <AnimatePresence mode="wait">
        {!profileReady ? null : !name ? (
          <motion.section
            key="nick"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 flex flex-col gap-4"
          >
            <h2 className="text-center text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">
              What do we call you?
            </h2>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
              <UserRound className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 18))}
                placeholder="Nickname"
                autoFocus
                className="w-full bg-transparent py-2 text-lg font-black text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setEmoji(a)}
                  className={`rounded-xl py-1.5 text-xl transition-all ${
                    emoji === a ? "scale-110 bg-violet-500/30 ring-2 ring-violet-400 glow-violet" : "opacity-70"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <Press
              variant="violet"
              size="lg"
              className="w-full"
              disabled={name.trim().length === 0}
              onClick={() => commitProfile()}
            >
              <Play className="h-5 w-5" /> That&apos;s my vibe
            </Press>
          </motion.section>
        ) : (
          <motion.section key="menu" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mt-10 flex flex-col gap-4">
            {/* profile pill */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{profile?.emoji ?? emoji}</span>
                <span className="font-black">{profile?.name ?? name}</span>
              </div>
              <button
                onClick={() => {
                  saveProfile({ name: "", emoji });
                  setName("");
                  setProfile(null);
                }}
                className="text-[11px] font-bold text-slate-400 underline"
              >
                edit
              </button>
            </div>

            <Press variant="acid" size="lg" className="w-full" onClick={handleCreate} disabled={busy !== null}>
              <Dices className="h-6 w-6" /> CREATE ROOM
            </Press>

            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
              <span className="h-px flex-1 bg-white/10" /> or join <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoin();
                }}
                placeholder="CODE"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                className="w-full rounded-2xl bg-slate-900/80 py-4 text-center text-3xl font-black tracking-[0.5em] text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              <Press
                variant="pink"
                size="lg"
                className="mt-3 w-full"
                onClick={handleJoin}
                disabled={busy !== null || joinCode.length < 4}
              >
                <DoorOpen className="h-6 w-6" /> JOIN PARTY
              </Press>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-center text-xs font-bold text-rose-300"
              >
                {error}
              </motion.p>
            )}

            <p className="mt-2 text-center text-[10px] font-bold text-slate-600">
              {backend === "local"
                ? "🧪 Local tab-party mode — each tab is a player. Try 4 tabs!"
                : backend === "supabase"
                  ? "🛰️ Server-managed rooms (Supabase)"
                  : "🛰️ Server-managed rooms — no database, rooms live in server memory"}
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---- supabase-mode create flow ---- */
async function createRemoteRoom(
  _code: string,
  _identity: ReturnType<typeof getRoomIdentity>,
  _profile: { name: string; emoji: string },
  router: ReturnType<typeof useRouter>,
  done: () => void,
) {
  try {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host: { id: _identity.playerId, name: _profile.name, emoji: _profile.emoji } }),
    });
    const json = (await res.json()) as { code?: string };
    if (json.code) router.push(`/room/${json.code}`);
    else done();
  } catch {
    done();
  }
}
