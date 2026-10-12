import { Hash, LayoutDashboard, Settings2, ShieldAlert, ShieldCheck, Users, type LucideIcon } from "lucide-react";

export interface ControlPanelSection {
  id: string;
  label: string;
  icon: LucideIcon;
  /** One line shown under the page title. */
  description: string;
  /** Sections without a built screen show a "coming soon" panel. */
  planned?: string[];
}

export const SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "How your server is doing at a glance.",
  },
  {
    id: "channels",
    label: "Channels",
    icon: Hash,
    description: "Every text, voice and mixed channel on this server.",
  },
  {
    id: "members",
    label: "Members",
    icon: Users,
    description: "Everyone with an account on this server.",
  },
  {
    id: "roles",
    label: "Roles & privileges",
    icon: ShieldCheck,
    description: "Decide who can do what.",
    planned: ["Create and edit roles", "Assign roles to members", "Review the privileges each role grants"],
  },
  {
    id: "moderation",
    label: "Moderation",
    icon: ShieldAlert,
    description: "Keep the community safe.",
    planned: ["Time out or ban members", "Review the moderation log", "Manage blocked IP addresses"],
  },
  {
    id: "settings",
    label: "Server settings",
    icon: Settings2,
    description: "Name, branding and limits.",
    planned: ["Name, description and welcome message", "Avatar and banner", "Message and upload size limits"],
  },
] as const satisfies readonly ControlPanelSection[];

export type SectionId = (typeof SECTIONS)[number]["id"];

export const DEFAULT_SECTION: SectionId = "overview";

export const isSectionId = (value: string | undefined): value is SectionId => SECTIONS.some((s) => s.id === value);
