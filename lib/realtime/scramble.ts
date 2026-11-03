/**
 * DEVELOPMENT-ONLY obfuscation for private game data in local (tab-test) mode.
 *
 * Private views must never ride the BroadcastChannel (any tab could listen),
 * so they are written to storage shards and lightly scrambled with a
 * room-derived key. This stops casual shoulder-surfing via the Network tab
 * or channel traffic — it is NOT real cryptography, and production mode uses
 * a server-authoritative API instead. Documented trade-off, noted in README.
 */

export function keyFor(roomCode: string): Uint8Array {
  const raw = `impostr::${roomCode.toUpperCase()}::v1`;
  const arr = new Uint8Array(32);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = (raw.charCodeAt(i % raw.length) * 31 + i * 7) & 0xff;
  }
  return arr;
}

function xorBuf(bytes: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
  return out;
}

export function scrambleJson(value: unknown, roomCode: string): string {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const enc = btoa(String.fromCharCode(...xorBuf(json, keyFor(roomCode))));
  return enc;
}

export function descrambleJson<T>(payload: string, roomCode: string): T | null {
  try {
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(xorBuf(bytes, keyFor(roomCode)));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
