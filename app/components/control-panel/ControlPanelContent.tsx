import type { Dispatch, SetStateAction } from "react";
import type { Channel } from "../../models";
import type { InstancePrivilege, InstanceRole } from "../../services/system";
import type { ListUsersResponse } from "../../services/user";
import type { ShowToast } from "../Toast";
import { RolesTab } from "./RoleManagement";
import { BlockedIPsTab } from "./tabs/BlockedIPsTab";
import { InstancePingTab } from "./tabs/InstancePingTab";
import { ChannelsTab } from "./tabs/ChannelsTab";
import { LogsTab } from "./tabs/LogsTab";
import { MembersTab } from "./tabs/MembersTab";
import { ModerationTab } from "./tabs/ModerationTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { SecurityTab } from "./tabs/SecurityTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { StorageTab } from "./tabs/StorageTab";
import { TasksTab } from "./tabs/TasksTab";
import type { ControlPanelTab, ControlPanelTabId, StorageFile } from "./types";

type FileViewerModalState = {
  isOpen: boolean;
  file: StorageFile | null;
};

type ControlPanelContentProps = {
  activeTab: ControlPanelTabId;
  tabs: ControlPanelTab[];
  showToast: ShowToast;
  controlPanelAuthToken: string;
  controlPanelPrivileges: InstancePrivilege[];
  controlPanelRoles: InstanceRole[];
  controlPanelUsers: ListUsersResponse["users"];
  controlPanelChannels: Channel[];
  setActiveTab: (tab: ControlPanelTabId) => void;
  setChannelCreationModalOpen: (value: boolean) => void;
  setControlPanelChannels: Dispatch<SetStateAction<Channel[]>>;
  fetchControlPanelData: (authTokenOverride?: string) => Promise<void>;
  fileViewerModal: FileViewerModalState;
  setFileViewerModal: Dispatch<SetStateAction<FileViewerModalState>>;
};

export function ControlPanelContent({
  activeTab,
  tabs,
  showToast,
  controlPanelAuthToken,
  controlPanelPrivileges,
  controlPanelRoles,
  controlPanelUsers,
  controlPanelChannels,
  setActiveTab,
  setChannelCreationModalOpen,
  setControlPanelChannels,
  fetchControlPanelData,
  fileViewerModal,
  setFileViewerModal,
}: ControlPanelContentProps) {
  const openConfigurationTab = () => {
    const settingsTab = tabs.find((tab) => tab.id === "settings" || tab.id === "storage" || tab.id === "security");
    if (settingsTab) {
      setActiveTab(settingsTab.id);
    }
  };

  const activeTabContent = (
    <>
      {activeTab === "overview" && <OverviewTab onSettingsClick={openConfigurationTab} />}
      {activeTab === "moderation" && <ModerationTab showToast={showToast} />}
      {activeTab === "members" && (
        <MembersTab
          roles={controlPanelRoles}
          users={controlPanelUsers}
          onOpenRolesTab={() => setActiveTab("roles")}
          showToast={showToast}
        />
      )}
      {activeTab === "roles" && (
        <RolesTab
          authToken={controlPanelAuthToken}
          privileges={controlPanelPrivileges}
          roles={controlPanelRoles}
          users={controlPanelUsers}
          onRolesChanged={async () => {
            await fetchControlPanelData(controlPanelAuthToken);
          }}
          showToast={showToast}
        />
      )}
      {activeTab === "channels" && (
        <ChannelsTab
          onOpenChannelModal={() => setChannelCreationModalOpen(true)}
          channels={controlPanelChannels}
          setChannels={setControlPanelChannels}
          showToast={showToast}
        />
      )}
      {activeTab === "tasks" && <TasksTab showToast={showToast} />}
      {activeTab === "logs" && <LogsTab showToast={showToast} />}
      {activeTab === "settings" && <SettingsTab showToast={showToast} />}
      {activeTab === "storage" && (
        <StorageTab
          showToast={showToast}
          fileViewerModal={fileViewerModal}
          setFileViewerModal={setFileViewerModal}
        />
      )}
      {activeTab === "security" && <SecurityTab />}
      {activeTab === "blocked-ips" && <BlockedIPsTab showToast={showToast} />}
      {activeTab === "instance-ping" && <InstancePingTab showToast={showToast} />}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-background)] p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex min-h-full flex-col [&>*]:min-h-full [&>*]:flex-1">
          {activeTabContent}
        </div>
      </div>
    </div>
  );
}
