import { useEffect, useState } from "react";
import type { Channel } from "../../models";
import { listChannels, createChannel } from "../../services/channel";
import { getAuthTokenForRequests } from "../../services/authSession";
import {
  listInstancePrivileges,
  listInstanceRoles,
  type InstancePrivilege,
  type InstanceRole,
} from "../../services/system";
import {
  getAuthTokenFromCookies,
  listUsers,
  type ListUsersResponse,
} from "../../services/user";
import { logger } from "../../utils/logger";

type UseControlPanelDataOptions = {
  isCurrentUserLoading: boolean;
  currentUser: unknown;
  currentUserError: unknown;
  canViewChannels: boolean;
  canViewMembers: boolean;
  canViewRoles: boolean;
};

export function useControlPanelData({
  isCurrentUserLoading,
  currentUser,
  currentUserError,
  canViewChannels,
  canViewMembers,
  canViewRoles,
}: UseControlPanelDataOptions) {
  const [isLoading, setIsLoading] = useState(true);
  const [controlPanelAuthToken, setControlPanelAuthToken] = useState("");
  const [controlPanelChannels, setControlPanelChannels] = useState<Channel[]>([]);
  const [controlPanelUsers, setControlPanelUsers] = useState<ListUsersResponse["users"]>([]);
  const [controlPanelRoles, setControlPanelRoles] = useState<InstanceRole[]>([]);
  const [controlPanelPrivileges, setControlPanelPrivileges] = useState<InstancePrivilege[]>([]);

  const resolveControlPanelAuthToken = (authTokenOverride?: string) =>
    authTokenOverride || getAuthTokenForRequests() || getAuthTokenFromCookies() || "";

  const fetchControlPanelData = async (authTokenOverride?: string) => {
    const authToken = resolveControlPanelAuthToken(authTokenOverride);
    setControlPanelAuthToken(authToken);

    if (!authToken) {
      logger.ui.error("No auth token available for control panel data fetching");
      setIsLoading(false);
      return;
    }

    try {
      logger.ui.info("Fetching control panel data with auth token", { tokenPresent: !!authToken });

      if (canViewChannels) {
        const channelsResponse = await listChannels(authToken);
        if (channelsResponse.success && channelsResponse.data?.channels) {
          setControlPanelChannels(channelsResponse.data.channels);
          logger.ui.info("Channels fetched successfully for control panel", {
            count: channelsResponse.data.channels.length,
            channelNames: channelsResponse.data.channels.map((channel) => channel.channel_name),
          });
        } else {
          logger.ui.error("Failed to fetch channels for control panel", {
            error: channelsResponse.error,
            authTokenPresent: !!authToken,
          });
          setControlPanelChannels([]);
        }
      } else {
        setControlPanelChannels([]);
      }

      if (canViewMembers || canViewRoles) {
        const usersResponse = await listUsers(authToken);
        if (usersResponse.success && usersResponse.data?.users) {
          setControlPanelUsers(usersResponse.data.users);
          logger.ui.info("Users fetched successfully for control panel", {
            count: usersResponse.data.users.length,
            usernames: usersResponse.data.users.slice(0, 5).map((user) => user.username),
          });
        } else {
          logger.ui.error("Failed to fetch users for control panel", {
            error: usersResponse.error,
            authTokenPresent: !!authToken,
          });
          setControlPanelUsers([]);
        }
      } else {
        setControlPanelUsers([]);
      }

      if (canViewRoles) {
        const rolesResponse = await listInstanceRoles(authToken);
        if (rolesResponse.success && rolesResponse.data?.roles) {
          setControlPanelRoles(rolesResponse.data.roles);
        } else {
          logger.ui.warn("Failed to fetch instance roles for control panel", {
            error: rolesResponse.error,
          });
          setControlPanelRoles([]);
        }
      } else {
        setControlPanelRoles([]);
      }

      if (canViewRoles) {
        const privilegesResponse = await listInstancePrivileges(authToken);
        if (privilegesResponse.success && privilegesResponse.data?.privileges) {
          setControlPanelPrivileges(privilegesResponse.data.privileges);
        } else {
          logger.ui.warn("Failed to fetch instance privileges for control panel", {
            error: privilegesResponse.error,
          });
          setControlPanelPrivileges([]);
        }
      } else {
        setControlPanelPrivileges([]);
      }
    } catch (error) {
      logger.ui.error("Unexpected error fetching control panel data", { error });
      setControlPanelChannels([]);
      setControlPanelUsers([]);
      setControlPanelRoles([]);
      setControlPanelPrivileges([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isCurrentUserLoading) {
      return;
    }

    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    void fetchControlPanelData();
  }, [
    canViewChannels,
    canViewMembers,
    canViewRoles,
    currentUser,
    currentUserError,
    isCurrentUserLoading,
  ]);

  const refreshChannels = async (authTokenOverride?: string) => {
    const authToken = resolveControlPanelAuthToken(authTokenOverride);
    const channelsResponse = await listChannels(authToken);
    if (channelsResponse.success && channelsResponse.data?.channels) {
      setControlPanelChannels(channelsResponse.data.channels);
      return channelsResponse.data.channels;
    }
    return null;
  };

  const createControlPanelChannel = async (channelData: {
    name: string;
    type: "text" | "voice";
    description?: string;
    isPrivate?: boolean;
  }) => {
    const authToken = resolveControlPanelAuthToken();
    const response = await createChannel(
      {
        channel_name: channelData.name,
        is_private: channelData.isPrivate || false,
        channel_type: channelData.type,
      },
      authToken,
    );
    return { authToken, response };
  };

  return {
    isLoading,
    controlPanelAuthToken,
    controlPanelChannels,
    setControlPanelChannels,
    controlPanelUsers,
    controlPanelRoles,
    controlPanelPrivileges,
    fetchControlPanelData,
    refreshChannels,
    createControlPanelChannel,
    resolveControlPanelAuthToken,
  };
}
