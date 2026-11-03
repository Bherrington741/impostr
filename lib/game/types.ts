/**
 * Core domain types for Impostr.
 *
 * SECURITY MODEL
 * --------------
 * `PublicState` is the ONLY thing ever broadcast / stored for every client.
 * It must NEVER contain the secret word or the imposter's player id.
 * Those live in `PrivateBundle`, which only the server (or, in local-tab
 * dev mode, the authority tab) ever holds in full. Individual players learn
 * their own role exclusively through `PrivateView` — a per-player payload
 * requested with a private identity secret.
 */

export type Phase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "DISCUSSION"
  | "VOTING"
  | "IMPOSTER_LAST_CHANCE"
  | "RESULTS";

export type Role = "CREW" | "IMPOSTER";

export interface Player {
  id: string;
  name: string;
  emoji: string;
  joinedAt: number;
  isHost: boolean;
  connected: boolean;
}

export type Winner = "CREW" | "IMPOSTER_STEAL" | "IMPOSTER_ESCAPE";

export interface RoundResults {
  imposterId: string;
  secretWord: string;
  category: string;
  categoryHint: string;
  /** voterId -> target playerId */
  votes: Record<string, string | null>;
  caught: boolean;
  stealAttempt: string | null;
  stealSuccess: boolean;
  winner: Winner;
}

export interface PublicState {
  code: string;
  phase: Phase;
  round: number;
  hostId: string;
  players: Player[];
  settings: {
    packKey: string; // pack key, or "random"
    timerMinutes: number; // 1..5 discussion timer
    customWords: boolean; // deal one of the crew's own submitted words
  };
  /** Set once a round starts. Safe to broadcast. */
  category: string | null;
  categoryHint: string | null;
  /** Milliseconds epoch deadline for the current phase (discussion / voting / last chance). */
  endTime: number | null;
  /** playerIds in speaking order for this round (connected roster at deal time). */
  speakingOrder: string[];
  firstSpeakerId: string | null;
  /** Freshly dealt players. Spectators (joined mid-round) are not in the roster. */
  roster: string[];
  /** Players who finished tapping-and-holding the reveal card (ROLE_REVEAL). */
  ready: string[];
  /** Voter ids that locked a vote during VOTING (targets stay hidden). */
  hasVoted: string[];
  /** Decoy words from the same category, offered to the imposter as steal options. Never the real word. */
  decoys: string[];
  /** PlayerIds who locked in a custom word this lobby (word text stays in PrivateBundle). */
  wordSubmissions: string[];
  results: RoundResults | null;
  scores: Record<string, number>;
  lastActionId: string;
  version: number;
  updatedAt: number;
}

/**
 * The hidden half of the game. Exists only on the authority
 * (server in supabase mode / host tab in local mode).
 */
export interface PrivateBundle {
  imposterId: string | null;
  secretWord: string | null;
  wordHint: string | null;
  /** Player-submitted words for custom-word mode. playerId -> word. Never broadcast. */
  proposals: Record<string, string>;
  /** voterId -> target playerId, kept private until RESULTS. */
  votes: Record<string, string | null>;
  lastChanceWord: string | null;
  stealSuccess: boolean;
}

export function emptyBundle(): PrivateBundle {
  return {
    imposterId: null,
    secretWord: null,
    wordHint: null,
    proposals: {},
    votes: {},
    lastChanceWord: null,
    stealSuccess: false,
  };
}

/**
 * What an individual player is allowed to see about their own role.
 * Served per-player (API route on the server; storage-shard in local mode).
 */
export interface PrivateView {
  playerId: string;
  round: number;
  role: Role;
  category: string | null;
  categoryHint: string | null;
  secretWord: string; // "???  (Blend in!)" for the imposter
}

export function roleView(pub: PublicState, bundle: PrivateBundle, playerId: string): PrivateView | null {
  if (!bundle.imposterId || !bundle.secretWord) return null;
  if (!pub.roster.includes(playerId)) return null;
  const isImposter = bundle.imposterId === playerId;
  return {
    playerId,
    round: pub.round,
    role: isImposter ? "IMPOSTER" : "CREW",
    category: pub.category,
    categoryHint: pub.categoryHint,
    secretWord: isImposter ? "???  (Blend in!)" : bundle.secretWord,
  };
}
