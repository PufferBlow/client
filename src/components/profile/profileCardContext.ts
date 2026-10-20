import { createContext, useContext } from "react";

export interface CardAnchor {
  x: number;
  y: number;
}

export interface ProfileCardControls {
  /** Open the card for a person, next to the point it was asked from. */
  open: (userId: string, anchor: CardAnchor) => void;
  close: () => void;
}

/** Outside a provider (a test, a page without one) opening a card does nothing. */
export const ProfileCardContext = createContext<ProfileCardControls>({ open: () => undefined, close: () => undefined });

export const useProfileCard = (): ProfileCardControls => useContext(ProfileCardContext);
