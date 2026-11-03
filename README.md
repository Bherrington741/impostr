# 🎭 Impostr — Party of Lies

A real-time, mobile-first social deduction party game. One secret word is dealt to the whole
crew — except the **Imposter**, who only knows the category. Give one-word clues, smell the rat,
and vote. Ran off the couch, the imposter gets **15 seconds to steal the win** by naming the word.

Built with **Next.js (App Router) + TypeScript + Tailwind v4 + Framer Motion + Lucide**.

---

## Play it right now (zero config — Local Tab-Party mode)

```bash
npm install
npm run dev
# open http://localhost:3000
```

1. Tab 1: pick a nickname → **CREATE ROOM** → a 4-letter code is generated.
2. Open **3 more browser tabs** (the same URL). Each tab is a separate player via per-tab identity.
3. In each new tab, pick a nickname → type the code → **JOIN PARTY**.
4. Host taps **START GAME** (needs 3+ players). Every card is private to that tab/phone.

> Why sessionStorage, not localStorage, for player identity? Multiple tabs on one machine share
> localStorage — that would make every tab the *same* player. sessionStorage keeps the identity
> per tab (refresh-safe), so a laptop can simulate a whole party. On real phones each browser is
> naturally its own identity.

## Server mode (no database) — recommended for simple deploys

`NEXT_PUBLIC_BACKEND=server` runs the exact same server-authoritative flow as
Supabase mode, but rooms live **in the Node process's memory**
(`lib/server/memory-store.ts`) — no database, no external services.

- Deploying on a VPS (e.g. CloudPanel): Node 20 + PM2 (`next start`), NGINX
  reverse proxy in front. **Run PM2 in fork mode (one process)** — rooms are
  in-memory, so cluster mode would split the player base.
- Rooms are wiped on server restart (deploy/reboot) — fine for a party game.
- Idle rooms are pruned after 12h.
- Realtime: clients poll public state every 2s; the acting device refetches
  instantly (action route returns `changed`), so play feels live.
- Host safety: the host gets a 60s presence grace window (vs 9s for guests),
  so a slow-loading host tab can't have its room stolen by host migration.

## Switching to production (Supabase)

```bash
cp .env.example .env.local
# fill in the Supabase keys
```

1. Run `supabase/schema.sql` in the Supabase SQL editor (creates tables, RLS, realtime publication).
2. Set `NEXT_PUBLIC_BACKEND=supabase` + `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm run dev` — rooms are now server-authoritative:

- `GET  /api/rooms/:code` — public state (runs a lazy engine tick so timers advance)
- `POST /api/rooms/:code` — validated action envelope (join/start/vote/steal/ping…)
- `GET  /api/rooms/:code/private` — **per-player** role view; only served when the request
  carries that device's identity secret.

(The same three routes power `server` mode — only the storage behind them differs.)

## Anti-cheat architecture

| Danger | Defense |
| --- | --- |
| Secret word / imposter id in the room state | `PublicState` **never** contains them. They live in `PrivateBundle`, held only by the server (Supabase mode) or the authority tab (local mode). |
| Every tab seeing everyone's role | Roles are minted as per-player `PrivateView`s and delivered only against that device's identity secret. |
| Hidden votes leaking during VOTING | Votes map lives in `PrivateBundle`; the public state only carries `hasVoted` ids. Full breakdown is computed only at RESULTS. |
| Double-applied transitions | Every action envelope carries a client id; the engine ignores duplicates (idempotency). |
| Host tab closes mid-game | Presence sweep flags them disconnected; host migrates to the oldest connected player; the private bundle survives the handover via an obfuscated storage shard (local mode) or lives server-side (Supabase mode). |

> Local-mode note: private views/scores are stored as lightly-scrambled storage shards
> (`lib/realtime/scramble.ts`) so channel traffic can't be sniffed. That's development-grade
> obfuscation, not cryptography — production secrecy comes from the server-authoritative mode.

## Game flow (state machine)

`LOBBY → ROLE_REVEAL → DISCUSSION → VOTING → IMPOSTER_LAST_CHANCE → RESULTS → (play again → LOBBY)`

- **LOBBY** — share code / QR, live avatar grid, host picks word pack + timer, 3+ to deal.
- **ROLE_REVEAL** — press-and-hold card flip. Crewmates: word + category. Imposter: category only.
  Everyone locks in with "ready" checkmarks; discussion starts when all are ready.
- **DISCUSSION** — synchronized countdown ring, speaking order with the first speaker star-lit,
  host can force an early vote.
- **VOTING** — 60s window, one tap to accuse + confirm sheet, live ✓s without revealing targets.
- **IMPOSTER_LAST_CHANCE** — strict majority catch? 15-second steal window; the imposter types
  or picks from decoy words in the same category. Only the imposter's screen shows the steal UI.
- **RESULTS** — verdict, word reveal, full vote map, session scoreboard
  (+1 per correct catch, +2 steal win, +3 perfect escape), host deals the next round instantly.

## Known trade-offs & hardening notes

- **Profile is per-tab** (`sessionStorage` mirror, `impostr:profile:tab`), while the shared
  `localStorage` key still seeds brand-new tabs. Otherwise the last nickname saved in one tab
  would silently rename every tab in the party.
- **Private views are persisted *after* public + authority state.** A crash/handover in between
  can leave views missing (recoverable by re-dealing), but can never pair a role card with a
  different deal. The client also re-validates each view against the current round + category
  before displaying it.
- **Authority tabs re-seed the identity-secret registry from `impostr:sec:*` shards** before
  minting views, so a reloaded authority can still produce views for players who joined before
  its page load.
- **A correct steal guess can never be erased by the phase-expiry tick** — acceptance is gated
  on the phase itself, and `finalizeRound` reads the recorded result as-is.
- Local mode only: if the authority tab sits in a *background* browser tab, OS timer throttling
  can delay its engine ticks (timers resolve late, never incorrectly). The production
  Supabase mode runs the tick server-side and is unaffected.
- Dev diagnostic: `window.__impostrDebug` exposes received-message counters on each tab.

## Project map

```
app/
  page.tsx                      nickname gate → create / join
  room/[code]/page.tsx          phase-screens shell
  api/rooms/…                   server-mode + Supabase-mode authority routes
lib/
  game/engine.ts                pure state machine (used by BOTH backends)
  game/wordbank.ts              6 categories × 16 words + flavor hints (96 secrets)
  game/types.ts                 PublicState / PrivateBundle / PrivateView split
  game/protocol.ts              action envelopes (client id → idempotency)
  game/identity.ts              zero-friction identity + emoji avatars
  realtime/local.ts             BroadcastChannel + storage transport (multi-tab)
  realtime/poll.ts              2s polling + instant replay client (server mode)
  realtime/supabase.ts          Realtime + REST client (production)
  realtime/scramble.ts          dev-only shard obfuscation
  server/rooms.ts               store facade (memory ⇄ Supabase via env)
  server/memory-store.ts        no-database, in-process room store
  server/supabase-store.ts      Supabase service-role store for API routes
  useRoom.ts                    React binding (state, identity, private views)
components/
  screens/                      Lobby, Reveal, Discussion, Voting, LastChance, Results
  ui/                           Press, PlayerGrid, TimerRing, QrShare
supabase/schema.sql             production tables + RLS + realtime
```
