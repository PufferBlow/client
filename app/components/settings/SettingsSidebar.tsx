import { Link } from "react-router";
import type { SettingsTab, SettingsTabId } from "./types";

type SettingsSidebarProps = {
  tabs: SettingsTab[];
  activeTab: SettingsTabId;
  setActiveTab: (tab: SettingsTabId) => void;
};

export function SettingsSidebar({ tabs, activeTab, setActiveTab }: SettingsSidebarProps) {
  return (
    <div className="flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-background-secondary)]">
      <div className="flex h-12 items-center border-b border-[var(--color-border)] bg-[var(--color-background-tertiary)] px-4">
        {/* Cleaned up: dropped the accent-pill gear icon, the "User
            Settings" wording, and the red "USER" pill that used to
            hang at the far right. The leading icon was redundant
            (every row below already has its own glyph) and the badge
            duplicated information the user already knows (they
            opened settings — they know it's theirs). Single muted
            title now. */}
        <span className="text-sm font-semibold text-[var(--color-text)]">Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-2">
          <div className="mb-6">
            <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Account Settings
            </div>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`mb-1 flex w-full cursor-pointer items-center space-x-3 rounded-md px-3 py-2 text-left transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-[var(--color-active)] text-[var(--color-text)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                }`}
              >
                <div className={`transition-colors ${activeTab === tab.id ? "text-[var(--color-primary)]" : ""}`}>
                  {tab.icon}
                </div>
                <span className="text-sm font-medium">{tab.label}</span>
                {activeTab === tab.id && <div className="ml-auto h-6 w-1 rounded-full bg-[var(--color-primary)]" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Link
        to="/dashboard"
        className="m-2 flex cursor-pointer items-center space-x-3 rounded-lg p-2 text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
        title="Back to Dashboard"
      >
        <div className="ml-3 flex h-8 w-8 items-center justify-center">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </div>
        <span className="text-sm font-medium">Back to Dashboard</span>
      </Link>
    </div>
  );
}
