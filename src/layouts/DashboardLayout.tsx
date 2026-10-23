import { Outlet, useLocation } from "react-router";
import { CallOverlay } from "../components/dashboard/CallOverlay";
import { ServerRail } from "../components/dashboard/ServerRail";
import { UserPanel } from "../components/dashboard/UserPanel";
import { InstanceUnavailable } from "../components/instance/InstanceUnavailable";
import { ProfileCardProvider } from "../components/profile/ProfileCardProvider";
import { useInstanceStatus } from "../features/instance/status";
import { CallProvider } from "../features/calls/CallProvider";
import { RealtimeProvider } from "../features/realtime/RealtimeProvider";
import { VoiceProvider } from "../features/voice/VoiceProvider";
import { useSessionKeeper } from "../hooks/useSessionKeeper";

/** Full-page screens (settings, control panel) take the whole window; the server rail is for the chat views. */
const isFullPage = (pathname: string) => /^\/(settings|control-panel)(\/|$)/.test(pathname);

const isHubHome = (pathname: string) => /^\/dashboard\/?$/.test(pathname);

/**
 * App shell: server rail on the left, routed view filling the rest, realtime socket behind it.
 * When the instance can't be used at all, a full-window screen covers it (the shell stays
 * mounted, inert, so it is back as it was once the instance is).
 */
export function DashboardLayout() {
  useSessionKeeper();
  const { pathname } = useLocation();
  const showRail = !isFullPage(pathname);
  // The hub home is a landing page: no sidebar for the card to float over.
  const showUserPanel = showRail && !isHubHome(pathname);
  const status = useInstanceStatus();
  const blocked = status !== "ok";

  return (
    <RealtimeProvider>
      <VoiceProvider>
        <CallProvider>
          <ProfileCardProvider>
            <div className="relative flex h-full min-w-0 flex-1">
              <div
                inert={blocked}
                aria-hidden={blocked || undefined}
                className={`relative flex h-full min-w-0 flex-1 bg-background p-2 ${showRail ? "pl-0" : ""}`}
              >
                {showRail && <ServerRail />}
                <div className="flex min-h-0 min-w-0 flex-1 gap-2">
                  <Outlet />
                </div>
                {/* Its own card, floating bottom-left across the server list and the sidebar (72px + 288px, less the gutter). */}
                {showUserPanel && (
                  <div className="pointer-events-none absolute bottom-2 left-2 z-10 w-[352px] max-w-[calc(100%-1rem)]">
                    <UserPanel />
                  </div>
                )}
              </div>
              {blocked && <InstanceUnavailable status={status} />}
              <CallOverlay />
            </div>
          </ProfileCardProvider>
        </CallProvider>
      </VoiceProvider>
    </RealtimeProvider>
  );
}
