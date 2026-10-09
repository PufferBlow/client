import type { ReactNode } from "react";

export type SettingsTabId =
  | "profile"
  | "appearance"
  | "audio"
  | "server"
  | "security"
  // "Client" — local app preferences that live ON the device,
  // not in the user's profile or the home instance: hardware
  // acceleration, auto-update toggle, version readout. Distinct
  // from "Server" (which configures the home instance the user
  // connects to) and from "Appearance" (which is server-synced
  // theme state).
  | "client";

export type SettingsTab = {
  id: SettingsTabId;
  label: string;
  icon: ReactNode;
};
