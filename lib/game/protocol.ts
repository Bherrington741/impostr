/** Wire protocol for mutating a room. All actions are validated by the engine. */

export type Action =
  | { t: "join"; player: { id: string; name: string; emoji: string } }
  | { t: "ping" }
  | { t: "updateSettings"; packKey: string; timerMinutes: number; customWords?: boolean }
  | { t: "ready" }
  | { t: "start" }
  | { t: "submitWord"; word: string }
  | { t: "skipToVoting" }
  | { t: "castVote"; targetId: string }
  | { t: "stealGuess"; word: string }
  | { t: "playAgain" };

/**
 * Every mutation envelope carries a client-generated id. The engine ignores
 * duplicates so a briefly double-authority setup (local mode handover race)
 * can never apply the same transition twice.
 */
export interface ActionEnvelope {
  id: string;
  playerId: string;
  secret: string; // player identity secret; only the authority ever sees it
  action: Action;
}

export function makeEnvelope(playerId: string, secret: string, action: Action): ActionEnvelope {
  const id = `${playerId}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}`;
  return { id, playerId, secret, action };
}
