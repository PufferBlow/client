import { Link } from "react-router";
import type { ControlPanelTab, ControlPanelTabId } from "./types";

type ControlPanelSidebarProps = {
  activeTab: ControlPanelTabId;
  setActiveTab: (tab: ControlPanelTabId) => void;
  dashboardTabs: ControlPanelTab[];
  managementTabs: ControlPanelTab[];
  configurationTabs: ControlPanelTab[];
  securityTabs: ControlPanelTab[];
};

type SectionProps = {
  title: string;
  tabs: ControlPanelTab[];
  activeTab: ControlPanelTabId;
  setActiveTab: (tab: ControlPanelTabId) => void;
};

function ControlPanelSidebarSection({ title, tabs, activeTab, setActiveTab }: SectionProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </div>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`mb-1 flex w-full items-center space-x-3 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors duration-200 ${
            activeTab === tab.id
              ? "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
          }`}
        >
          <div
            className={`transition-colors ${
              activeTab === tab.id ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"
            }`}
          >
            {tab.icon}
          </div>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ControlPanelSidebar({
  activeTab,
  setActiveTab,
  dashboardTabs,
  managementTabs,
  configurationTabs,
  securityTabs,
}: ControlPanelSidebarProps) {
  return (
    <div className="flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-background-secondary)]">
      <div className="flex h-12 items-center border-b border-[var(--color-border)] bg-[var(--color-background-tertiary)] px-4">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] font-semibold text-[var(--color-text)]">
            P
          </div>
          <span className="text-sm font-semibold text-[var(--color-text)]">Server Control Panel</span>
        </div>
        <div className="ml-auto">
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            Host
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-2">
          <ControlPanelSidebarSection
            title="Dashboard"
            tabs={dashboardTabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <ControlPanelSidebarSection
            title="Community Management"
            tabs={managementTabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <ControlPanelSidebarSection
            title="Instance Configuration"
            tabs={configurationTabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <ControlPanelSidebarSection
            title="Security & Advanced"
            tabs={securityTabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>
      </div>

      <Link
        to="/dashboard"
        className="m-2 flex items-center space-x-3 rounded-lg border border-transparent p-2 text-[var(--color-text-secondary)] transition-colors duration-200 hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
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
