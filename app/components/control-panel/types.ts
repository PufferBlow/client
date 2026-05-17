import type { ReactNode } from "react";

export type StorageFile = {
  id: string;
  filename: string;
  subdirectory: string;
  size: number;
  type: string;
  uploaded_at: string;
  /**
   * Human-readable uploader name (the username if we resolved it,
   * otherwise the literal string "Unknown"). Kept as a non-nullable
   * string so existing UI that only renders this label still works.
   */
  uploader: string;
  is_orphaned: boolean;
  url: string;
  /**
   * Structured provenance, populated by the backend from FileReferences.
   * All fields are optional -- a file may resolve to a message attachment
   * (uploader + channel + message_id), to a user/server asset (uploader
   * only), or to nothing at all (orphan: every field below is undefined).
   * The preview sidebar uses these fields to show "who uploaded this and
   * where", with graceful fallbacks when a field is missing.
   */
  uploader_user_id?: string | null;
  uploader_username?: string | null;
  reference_type?: string | null;
  message_id?: string | null;
  channel_id?: string | null;
  channel_name?: string | null;
};

export type ControlPanelTabId =
  | "overview"
  | "activity"
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
