import type { ReactNode } from "react";

export type StorageFile = {
  id: string;
  filename: string;
  path: string;
  size: number;
  type: string;
  uploaded_at: string;
  uploader: string;
  is_orphaned: boolean;
  url: string;
};

export type ControlPanelTabId =
  | "overview"
  | "moderation"
  | "members"
  | "roles"
  | "channels"
  | "tasks"
  | "logs"
  | "settings"
  | "storage"
  | "security"
  | "blocked-ips"
  | "instance-ping";

export type ControlPanelTab = {
  id: ControlPanelTabId;
  label: string;
  icon: ReactNode;
};
