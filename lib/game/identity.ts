/**
 * Player identity — zero-friction "auth".
 *
 * The nickname/emoji profile lives in localStorage (shared, applies to new tabs).
 * The per-room playerId + secret live in sessionStorage so that:
 *  - refreshing the page keeps you in the room (session survives reload),
 *  - multiple tabs on the same machine act as distinct players,
 *    which is exactly how we test local multiplayer.
 * On real phones (different browsers) each session is naturally distinct.
 */

export interface Profile {
  name: string;
  emoji: string;
}

export interface RoomIdentity {
  playerId: string;
  secret: string;
  name: string;
  emoji: string;
}

export const AVATARS = [
  "👽", "🐸", "🦊", "🐼", "🐙", "🦄", "🐲", "🍕", "🎧", "🚀", "⚡", "🌝",
  "🍄", "🎲", "🍒", "🐳", "🦖", "🪐", "🕶️", "🧊", "🎯", "🦩", "🧃", "🪩",
];

const PROFILE_KEY = "impostr:profile";
/**
 * Per-tab profile mirror (sessionStorage). In local tab-party mode several
 * tabs share one localStorage, so the "last profile saved" would otherwise
 * rename every tab in the room. The session mirror pins THIS tab's choice,
 * while the shared localStorage key still seeds brand-new tabs/phones.
 */
const SESSION_PROFILE_KEY = "impostr:profile:tab";
const id = (code: string) => `impostr:me:${code.toUpperCase()}`;

export function randomSecret(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadProfile(): Profile | null {
  try {
    const mine = sessionStorage.getItem(SESSION_PROFILE_KEY);
    if (mine) return JSON.parse(mine) as Profile;
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  const clean = { name: profile.name.trim().slice(0, 18), emoji: profile.emoji };
  try {
    sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(clean));
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
  } catch {
    /* private mode — fine */
  }
}

export function guessEmoji(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATARS[Math.abs(hash) % AVATARS.length];
}

/**
 * Stable per-tab identity for a room. Creates one if the tab has never joined.
 * Call only in browser context.
 */
export function getRoomIdentity(code: string, profile?: Profile | null): RoomIdentity {
  const key = id(code);
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw) as RoomIdentity;
  } catch {
    /* ignore */
  }
  const name = (profile?.name ?? "").trim();
  const identity: RoomIdentity = {
    playerId: crypto.randomUUID(),
    secret: randomSecret(),
    name: name || `Guest ${Math.floor(100 + Math.random() * 900)}`,
    emoji: profile?.emoji || guessEmoji(name || "guess"),
  };
  try {
    sessionStorage.setItem(key, JSON.stringify(identity));
  } catch {
    /* ignore */
  }
  // Pin this tab's profile choice so a later join from another tab (same
  // browser) cannot rename us on refresh.
  if (profile?.name?.trim()) {
    try {
      const existing = sessionStorage.getItem(SESSION_PROFILE_KEY);
      if (!existing) {
        sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify({ name: identity.name, emoji: identity.emoji }));
      }
    } catch {
      /* ignore */
    }
  }
  return identity;
}
