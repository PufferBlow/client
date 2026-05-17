/**
 * SecurityTab — placeholder UI for instance-level security toggles
 * (content moderation, spam protection, IP logging).
 *
 * The enable/disable controls match the checkbox pattern used in the
 * Tasks tab so the same affordance shows up everywhere a toggle is
 * really a binary "feature on/off" choice. Wiring to the backend lives
 * in follow-up work; this file stays local-state-only for now so the
 * shape is right when those endpoints land.
 */
import { useState } from "react";
import { Check } from "lucide-react";
import {
  cx,
  controlPanelSectionClass,
} from "../shared";

type SecurityToggleId = "content_moderation" | "spam_protection" | "ip_logging";

type SecurityToggle = {
  id: SecurityToggleId;
  label: string;
  description: string;
  defaultEnabled: boolean;
};

const SECURITY_TOGGLES: SecurityToggle[] = [
  {
    id: "content_moderation",
    label: "Content Moderation",
    description: "Automatically filter inappropriate content",
    defaultEnabled: false,
  },
  {
    id: "spam_protection",
    label: "Spam Protection",
    description: "Prevent spam messages and raids",
    defaultEnabled: false,
  },
  {
    id: "ip_logging",
    label: "IP Logging",
    description: "Log IP addresses for security monitoring",
    defaultEnabled: true,
  },
];

export function SecurityTab() {
  // Local-state-only for now; matches the placeholder behaviour the
  // tab had with its old red/green buttons. When the runtime-config
  // wiring lands these toggles should call into the same channel the
  // Settings tab uses.
  const [enabledMap, setEnabledMap] = useState<Record<SecurityToggleId, boolean>>(() => {
    const initial = {} as Record<SecurityToggleId, boolean>;
    for (const toggle of SECURITY_TOGGLES) {
      initial[toggle.id] = toggle.defaultEnabled;
    }
    return initial;
  });

  const toggle = (id: SecurityToggleId) => {
    setEnabledMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-6">
      <div className={cx(controlPanelSectionClass, "flex min-h-0 flex-1 flex-col")}>
        <h2 className="mb-6 text-lg font-medium text-[var(--color-text)]">Security Settings</h2>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {SECURITY_TOGGLES.map((entry) => {
            const enabled = enabledMap[entry.id];
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg"
              >
                <div>
                  <div className="font-medium text-[var(--color-text)]">{entry.label}</div>
                  <div className="text-[var(--color-text-secondary)] text-sm">{entry.description}</div>
                </div>
                {/* Square checkbox button — same shape as TasksTab so a
                    moderator scanning the control panel reads "feature
                    on/off" consistently across tabs. */}
                <button
                  type="button"
                  onClick={() => toggle(entry.id)}
                  className="flex items-center space-x-2 group"
                  aria-pressed={enabled}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                      enabled
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-transparent group-hover:bg-[var(--color-hover)]"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-sm text-[var(--color-text)]">
                    {enabled ? "Enabled" : "Disabled"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
