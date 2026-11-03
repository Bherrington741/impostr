/**
 * Impostr engine — pure, deterministic-ish game state machine.
 *
 * This module never touches the network or storage. It is used in two places:
 *  - the "authority tab" in local BroadcastChannel mode (dev / LAN-of-one),
 *  - Next.js API routes backed by Supabase (production, server-authoritative).
 *
 * ANTI-CHEAT: nothing in the returned PublicState ever includes the secret
 * word or imposter id. Those live only in PrivateBundle.
 */

import type { Action, ActionEnvelope } from "./protocol";
import {
  emptyBundle,
  roleView,
  type Player,
  type PrivateBundle,
  type PublicState,
  type RoundResults,
  type Winner,
} from "./types";
import { dealWord, type Deal, type WordPack } from "./wordbank";

export const VOTE_SECONDS = 60;
export const LAST_CHANCE_SECONDS = 15;
export const CONNECTED_STALE_MS = 8000;
export const MIN_PLAYERS = 3;

export interface GameModel {
  pub: PublicState;
  priv: PrivateBundle;
}

export function cloneModel(m: GameModel): GameModel {
  return { pub: structuredClone(m.pub), priv: structuredClone(m.priv) };
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O — harder to misread
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function nowMs() {
  return Date.now();
}

function touch(pub: PublicState) {
  pub.version += 1;
  pub.updatedAt = nowMs();
}

/** Create fresh lobby state. Called once when a room is created. */
export function newState(
  code: string,
  host: { id: string; name: string; emoji: string },
  opts?: { packKey?: string; timerMinutes?: number },
): PublicState {
  const players: Player[] = [
    {
      id: host.id,
      name: host.name,
      emoji: host.emoji,
      joinedAt: nowMs(),
      isHost: true,
      connected: true,
    },
  ];
  return {
    code,
    phase: "LOBBY",
    round: 0,
    hostId: host.id,
    players,
    settings: {
      packKey: opts?.packKey ?? "random",
      timerMinutes: Math.min(5, Math.max(1, opts?.timerMinutes ?? 3)),
      customWords: false,
    },
    category: null,
    categoryHint: null,
    endTime: null,
    speakingOrder: [],
    firstSpeakerId: null,
    roster: [],
    ready: [],
    hasVoted: [],
    decoys: [],
    wordSubmissions: [],
    results: null,
    scores: {},
    lastActionId: "",
    version: 1,
    updatedAt: nowMs(),
  };
}

/** Players eligible to act this round (dealt in + still connected). */
export function eligibleRoster(pub: PublicState): Player[] {
  return pub.players.filter((p) => p.connected && pub.roster.includes(p.id));
}

export function hostPlayer(pub: PublicState): Player | undefined {
  return pub.players.find((p) => p.id === pub.hostId);
}

/** Update connected flags on the public state. Returns true if anything changed. */
export function markPresence(pub: PublicState, connectedIds: Set<string>): boolean {
  let changed = false;
  for (const p of pub.players) {
    const connected = connectedIds.has(p.id);
    if (p.connected !== connected) {
      p.connected = connected;
      changed = true;
    }
  }
  return changed;
}

/** Migrate host to the oldest connected player if the current host dropped. */
function hostMigration(pub: PublicState): boolean {
  const host = hostPlayer(pub);
  if (host && host.connected) return false;
  const candidates = [...pub.players].filter((p) => p.connected).sort((a, b) => a.joinedAt - b.joinedAt);
  if (candidates.length === 0) return false;
  const next = candidates[0];
  for (const p of pub.players) p.isHost = p.id === next.id;
  pub.hostId = next.id;
  touch(pub);
  return true;
}

export function upsertPlayer(
  pub: PublicState,
  p: { id: string; name: string; emoji: string },
): boolean {
  const existing = pub.players.find((x) => x.id === p.id);
  const name = (p.name || "").trim().slice(0, 18) || "Player";
  if (existing) {
    let changed = false;
    if (existing.name !== name && existing.name !== "Player") {
      existing.name = name || existing.name;
      changed = true;
    }
    if (existing.name === "Player" && name) {
      existing.name = name;
      changed = true;
    }
    if (existing.emoji !== p.emoji) {
      existing.emoji = p.emoji;
      changed = true;
    }
    if (!existing.connected) {
      existing.connected = true;
      changed = true;
    }
    return changed;
  }
  pub.players.push({
    id: p.id,
    name,
    emoji: p.emoji,
    joinedAt: nowMs(),
    isHost: false,
    connected: true,
  });
  touch(pub);
  return true;
}

/**
 * Choose the round's word. In custom-word mode, one of the words submitted by
 * connected roster players is picked at random (the imposter only ever sees the
 * "Player Picks" category). Falls back to the word bank when nobody submitted
 * or the mode is off, so the game can always start.
 */
function dealForRound(
  pub: PublicState,
  priv: PrivateBundle,
  eligible: Player[],
): Deal {
  const proposals = pub.settings.customWords
    ? eligible
        .map((p) => ({ id: p.id, word: (priv.proposals?.[p.id] ?? "").trim() }))
        .filter((x) => x.word.length > 0)
    : [];
  if (proposals.length === 0) return dealWord(pub.settings.packKey);

  const pick = proposals[Math.floor(Math.random() * proposals.length)];
  const pack: WordPack = {
    key: "players",
    name: "Player Picks",
    emoji: "✍️",
    blurb: "Straight from the crew's own minds",
    words: [],
  };
  const author = eligible.find((p) => p.id === pick.id)?.name ?? "a crew member";
  return {
    pack,
    word: { w: pick.word, h: `Nominated by ${author}` },
    decoys: [],
  };
}

function beginRound(pub: PublicState, priv: PrivateBundle, env: ActionEnvelope): boolean {
  const eligible = pub.players.filter((p) => p.connected);
  if (eligible.length < MIN_PLAYERS) return false;

  const deal: Deal = dealForRound(pub, priv, eligible);
  pub.round += 1;
  pub.roster = eligible.map((p) => p.id);
  pub.category = deal.pack.name;
  pub.categoryHint = deal.pack.blurb;
  pub.decoys = deal.decoys;
  priv.imposterId = eligible[Math.floor(Math.random() * eligible.length)].id;
  priv.secretWord = deal.word.w;
  priv.wordHint = deal.word.h;
  priv.votes = {};
  priv.lastChanceWord = null;
  priv.stealSuccess = false;
  pub.ready = [];
  pub.hasVoted = [];
  pub.results = null;
  pub.speakingOrder = [];
  pub.firstSpeakerId = null;
  pub.phase = "ROLE_REVEAL";
  pub.endTime = null;
  touch(pub);
  return true;
}

function beginDiscussion(pub: PublicState): boolean {
  const roster = eligibleRoster(pub).map((p) => p.id);
  if (roster.length < MIN_PLAYERS) return false;
  pub.speakingOrder = shuffle(roster);
  pub.firstSpeakerId = pub.speakingOrder[0];
  pub.phase = "DISCUSSION";
  pub.endTime = nowMs() + pub.settings.timerMinutes * 60_000;
  touch(pub);
  return true;
}

function beginVoting(pub: PublicState): boolean {
  pub.phase = "VOTING";
  pub.endTime = nowMs() + VOTE_SECONDS * 1000;
  pub.hasVoted = [];
  touch(pub);
  return true;
}

function normalizeWord(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9']+/g, "");
}

/** End of VOTING: strict-majority catch → 15s steal window, else the imposter escapes. */
function resolveVoting(pub: PublicState, priv: PrivateBundle): void {
  const voters = eligibleRoster(pub).map((p) => p.id);
  const counts = new Map<string, number>();
  for (const [voter, target] of Object.entries(priv.votes)) {
    if (!voters.includes(voter) || !target) continue;
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const need = Math.floor(voters.length / 2) + 1;
  const caught = (counts.get(priv.imposterId ?? "") ?? 0) >= need;
  if (caught) {
    // Give the imposter their last chance — do NOT expose results yet.
    pub.phase = "IMPOSTER_LAST_CHANCE";
    pub.endTime = nowMs() + LAST_CHANCE_SECONDS * 1000;
    touch(pub);
  } else {
    finalizeRound(pub, priv);
  }
}

function finalizeRound(pub: PublicState, priv: PrivateBundle): void {
  const voters = eligibleRoster(pub).map((p) => p.id);
  const counts = new Map<string, number>();
  for (const [voter, target] of Object.entries(priv.votes)) {
    if (!voters.includes(voter) || !target) continue;
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const need = Math.floor(voters.length / 2) + 1;
  const imposterCount = counts.get(priv.imposterId!) ?? 0;
  const caught = imposterCount >= need;

  let winner: Winner;
  if (caught && priv.stealSuccess) winner = "IMPOSTER_STEAL";
  else if (caught) winner = "CREW";
  else winner = "IMPOSTER_ESCAPE";

  const results: RoundResults = {
    imposterId: priv.imposterId!,
    secretWord: priv.secretWord!,
    category: pub.category ?? "",
    categoryHint: pub.categoryHint ?? "",
    votes: { ...priv.votes },
    caught,
    stealAttempt: priv.lastChanceWord,
    stealSuccess: priv.stealSuccess,
    winner,
  };
  pub.results = results;

  // ---- scoring ----
  const scores = pub.scores;
  const delta: Record<string, number> = {};
  for (const [voter, target] of Object.entries(priv.votes)) {
    if (target === priv.imposterId) delta[voter] = (delta[voter] ?? 0) + 1; // caught the imposter
  }
  if (winner === "IMPOSTER_STEAL") delta[priv.imposterId!] = (delta[priv.imposterId!] ?? 0) + 2;
  if (winner === "IMPOSTER_ESCAPE") delta[priv.imposterId!] = (delta[priv.imposterId!] ?? 0) + 3;
  delta[priv.imposterId!] = delta[priv.imposterId!] ?? 0;
  for (const [id, d] of Object.entries(delta)) {
    scores[id] = (scores[id] ?? 0) + d;
  }

  pub.phase = "RESULTS";
  pub.endTime = null;
  touch(pub);
}

/** Periodic housekeeping: host migration + automatic phase transitions. */
export function tick(model: GameModel): boolean {
  const pub = model.pub;
  const priv = model.priv;
  let changed = hostMigration(pub);
  const now = nowMs();

  switch (pub.phase) {
    case "ROLE_REVEAL": {
      const roster = eligibleRoster(pub);
      if (roster.length >= MIN_PLAYERS && roster.every((p) => pub.ready.includes(p.id))) {
        changed = beginDiscussion(pub) || changed;
      }
      break;
    }
    case "DISCUSSION": {
      if (pub.endTime && now >= pub.endTime) {
        changed = beginVoting(pub) || changed;
      }
      break;
    }
    case "VOTING": {
      const roster = eligibleRoster(pub);
      const voted = roster.filter((p) => priv.votes[p.id]).length;
      const timeUp = pub.endTime !== null && now >= pub.endTime;
      if ((roster.length > 0 && voted >= roster.length) || timeUp) {
        resolveVoting(pub, priv);
        changed = true;
      }
      break;
    }
    case "IMPOSTER_LAST_CHANCE": {
      if (pub.endTime !== null && now >= pub.endTime) {
        // Do NOT reset stealSuccess here. stealGuess is gated by phase, so any
        // recorded success was submitted (and accepted) before this deadline —
        // wiping it would erase a legal last-second steal. finalizeRound reads
        // it as-is; no guess => false, correct guess => true.
        finalizeRound(pub, priv);
        changed = true;
      }
      break;
    }
    default:
      break;
  }
  return changed;
}

export interface IssuedView {
  playerId: string;
  secret: string;
  view: import("./types").PrivateView;
}

/**
 * Validate + apply one envelope. Returns whether public/private state changed
 * and any private views that must be persisted by the backend.
 * (Caller is responsible for persisting + broadcasting.)
 */
export function applyAction(model: GameModel, env: ActionEnvelope): { changed: boolean; views: IssuedView[] } {
  const pub = model.pub;
  const priv = model.priv;
  const mintedViews: IssuedView[] = [];
  if (env.id === pub.lastActionId) return { changed: false, views: mintedViews };
  const player = pub.players.find((p) => p.id === env.playerId);
  const action = env.action;
  const now = nowMs();
  let changed = false;
  let accept = true;

  switch (action.t) {
    case "join": {
      changed = upsertPlayer(pub, action.player) || changed;
      // The engine keeps identity secrets ONLY to mint private views.
      // It never exposes them through any public output.
      registerSecret(env.playerId, env.secret);
      break;
    }
    case "ping": {
      if (player && !player.connected) {
        player.connected = true;
        changed = true;
      }
      break;
    }
    case "updateSettings": {
      if (!player?.isHost || pub.phase !== "LOBBY") { accept = false; break; }
      const packKey = action.packKey;
      const timer = Math.min(5, Math.max(1, Math.round(action.timerMinutes)));
      if (pub.settings.packKey !== packKey) {
        pub.settings.packKey = packKey;
        changed = true;
      }
      if (pub.settings.timerMinutes !== timer) {
        pub.settings.timerMinutes = timer;
        changed = true;
      }
      if (action.customWords !== undefined && pub.settings.customWords !== action.customWords) {
        pub.settings.customWords = action.customWords;
        // Mode flip invalidates every proposal — drop them wholesale.
        priv.proposals = {};
        pub.wordSubmissions = [];
        changed = true;
      }
      break;
    }
    case "ready": {
      if (pub.phase !== "ROLE_REVEAL" || !pub.roster.includes(env.playerId)) { accept = false; break; }
      if (!pub.ready.includes(env.playerId)) {
        pub.ready.push(env.playerId);
        changed = true;
      }
      break;
    }
    case "start": {
      if (!player?.isHost || pub.phase !== "LOBBY") { accept = false; break; }
      changed = beginRound(pub, priv, env) || changed;
      if (changed) mintedViews.push(...issuePrivateViews(pub, priv, secretFor));
      break;
    }
    case "submitWord": {
      if (!pub.settings.customWords) { accept = false; break; }
      if (pub.phase !== "LOBBY") { accept = false; break; }
      if (!player || !player.connected) { accept = false; break; }
      priv.proposals ??= {};
      pub.wordSubmissions ??= [];
      const word = action.word.trim().slice(0, 40);
      if (!word) {
        // Empty word = withdrawal.
        if (priv.proposals[env.playerId]) {
          delete priv.proposals[env.playerId];
          pub.wordSubmissions = pub.wordSubmissions.filter((id) => id !== env.playerId);
          changed = true;
        }
        break;
      }
      if (priv.proposals[env.playerId] === word) { accept = false; break; }
      priv.proposals[env.playerId] = word;
      if (!pub.wordSubmissions.includes(env.playerId)) pub.wordSubmissions.push(env.playerId);
      changed = true;
      break;
    }
    case "skipToVoting": {
      if (!player?.isHost || pub.phase !== "DISCUSSION") { accept = false; break; }
      changed = beginVoting(pub) || changed;
      break;
    }
    case "castVote": {
      if (pub.phase !== "VOTING") { accept = false; break; }
      const voters = eligibleRoster(pub);
      if (!voters.some((p) => p.id === env.playerId)) { accept = false; break; }
      if (action.targetId === env.playerId) { accept = false; break; }
      if (!voters.some((p) => p.id === action.targetId)) { accept = false; break; }
      if (priv.votes[env.playerId] === action.targetId) { accept = false; break; }
      priv.votes[env.playerId] = action.targetId;
      if (!pub.hasVoted.includes(env.playerId)) pub.hasVoted.push(env.playerId);
      changed = true;
      const votedAll = voters.every((p) => priv.votes[p.id]);
      if (votedAll) {
        resolveVoting(pub, priv);
      }
      break;
    }
    case "stealGuess": {
      if (pub.phase !== "IMPOSTER_LAST_CHANCE") { accept = false; break; }
      if (env.playerId !== priv.imposterId) { accept = false; break; }
      priv.lastChanceWord = action.word.slice(0, 40);
      priv.stealSuccess = normalizeWord(action.word) === normalizeWord(priv.secretWord ?? "");
      changed = true;
      break;
    }
    case "playAgain": {
      if (!player?.isHost || pub.phase !== "RESULTS") { accept = false; break; }
      pub.phase = "LOBBY";
      pub.category = null;
      pub.categoryHint = null;
      pub.endTime = null;
      pub.roster = [];
      pub.ready = [];
      pub.hasVoted = [];
      pub.decoys = [];
      pub.wordSubmissions = [];
      pub.speakingOrder = [];
      pub.firstSpeakerId = null;
      pub.results = null;
      priv.imposterId = null;
      priv.secretWord = null;
      priv.wordHint = null;
      priv.proposals = {};
      priv.votes = {};
      priv.lastChanceWord = null;
      priv.stealSuccess = false;
      changed = true;
      break;
    }
    default:
      accept = false;
  }

  if (!changed) return { changed: false, views: mintedViews };
  if (accept) {
    pub.lastActionId = env.id;
    touch(pub);
  }
  void now;
  return { changed, views: mintedViews };
}

/* ------------------------------------------------------------------ */
/* Private-view issuance (authority side)                              */
/* ------------------------------------------------------------------ */

/**
 * Identity secrets the engine holds in memory purely to mint private views
 * after roles are dealt. They are never exposed through any public output.
 * In local mode they arrive via join envelopes; in server mode via the
 * action route (same code path).
 */
const secretIndex = new Map<string, string>();

export function registerSecret(playerId: string, secret: string) {
  if (playerId && secret) secretIndex.set(playerId, secret);
}

export function secretFor(playerId: string): string | undefined {
  return secretIndex.get(playerId);
}

/**
 * Mint one private view per roster player, paired with that player's identity
 * secret. Pure — the backend decides where to persist them:
 *  - local mode: storage shards written so ONLY the owning tab (with the
 *    matching secret) may decrypt its own view,
 *  - server mode: a per-player table, served through the private-view API
 *    route after re-verifying the secret.
 */
export function issuePrivateViews(
  pub: PublicState,
  priv: PrivateBundle,
  secretFor: (playerId: string) => string | undefined,
): IssuedView[] {
  if (!priv.imposterId || !priv.secretWord) return [];
  const out: IssuedView[] = [];
  for (const id of pub.roster) {
    const view = roleView(pub, priv, id);
    const secret = secretFor(id);
    if (!view || !secret) continue;
    out.push({ playerId: id, secret, view });
  }
  return out;
}
