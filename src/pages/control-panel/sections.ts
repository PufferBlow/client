import {
  Activity,
  Ban,
  Eye,
  Flag,
  Globe,
  Hash,
  Key,
  LayoutDashboard,
  Network,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";

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
  { id: "overview", label: "Overview", icon: LayoutDashboard, description: "How your server is doing at a glance." },
  { id: "health", label: "Health", icon: Activity, description: "Is everything up, how fast, and what went wrong." },
  {
    id: "settings",
    label: "Settings",
    icon: Settings2,
    description: "Name, privacy, upload limits and the server look.",
  },
  { id: "members", label: "Members", icon: Users, description: "Everyone with an account on this server." },
  { id: "channels", label: "Channels", icon: Hash, description: "Every text, voice and mixed channel on this server." },
  {
    id: "roles",
    label: "Roles",
    icon: Key,
    description: "Decide who can do what.",
  },
  { id: "peers", label: "Peers", icon: Globe, description: "The instances this one federates with, and the rules for each." },
  {
    id: "relays",
    label: "Relays",
    icon: Network,
    description: "Servers that pass messages between instances.",
    planned: ["Add and remove relays", "See what each relay carries"],
  },
  {
    id: "blocklist",
    label: "Blocklist",
    icon: Ban,
    description: "Instances that are not welcome here.",
  },
  {
    id: "reports",
    label: "Reports",
    icon: Flag,
    description: "Reports from members, and the addresses that are blocked.",
  },
  {
    id: "audit",
    label: "Audit log",
    icon: Eye,
    description: "Who changed what, and when.",
  },
] as const satisfies readonly ControlPanelSection[];

export type SectionId = (typeof SECTIONS)[number]["id"];

/** How the navigation groups the sections, in order. */
export const GROUPS: ReadonlyArray<{ name: string; ids: readonly SectionId[] }> = [
  { name: "Instance", ids: ["overview", "health", "settings"] },
  { name: "Community", ids: ["members", "channels", "roles"] },
  { name: "Federation", ids: ["peers", "relays", "blocklist"] },
  { name: "Safety", ids: ["reports", "audit"] },
];

export const DEFAULT_SECTION: SectionId = "overview";

export const isSectionId = (value: string | undefined): value is SectionId => SECTIONS.some((s) => s.id === value);
