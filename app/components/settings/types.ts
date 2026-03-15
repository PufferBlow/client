import type { ReactNode } from "react";

export type SettingsTabId = "profile" | "appearance" | "audio" | "server" | "security";

export type SettingsTab = {
  id: SettingsTabId;
  label: string;
  icon: ReactNode;
};
