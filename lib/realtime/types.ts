import type { Action, ActionEnvelope } from "@/lib/game/protocol";
import type { PrivateView, PublicState } from "@/lib/game/types";
import type { RoomIdentity } from "@/lib/game/identity";

export type BackendKind = "local" | "supabase" | "server";

export interface RoomClientHandlers {
  onPublic(state: PublicState): void;
  /** Private views were re-minted (e.g. roles dealt). Refetch yours. */
  onPrivateInvalidated(): void;
}

export interface RoomClient {
  kind: BackendKind;
  /** Start listening + announce presence. Persistent across HMR-safe re-runs is the hook's job. */
  connect(identity: RoomIdentity, handlers: RoomClientHandlers): void;
  destroy(): void;
  /** Fire a validated-by-server mutation. */
  send(action: Action): void;
  /** Owner-only view of this player's role. Verifies the identity secret. */
  getPrivateView(identity: RoomIdentity): Promise<PrivateView | null>;
}

export interface CreatedRoomInfo {
  ok: true;
  code: string;
}

export type { ActionEnvelope };
