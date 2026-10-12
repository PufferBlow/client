import { Outlet, useLocation } from "react-router";
import { ServerRail } from "../components/dashboard/ServerRail";
import { RealtimeProvider } from "../features/realtime/RealtimeProvider";
import { VoiceProvider } from "../features/voice/VoiceProvider";
import { useSessionKeeper } from "../hooks/useSessionKeeper";

/** Full-page screens (settings, control panel) take the whole window; the server rail is for the chat views. */
const isFullPage = (pathname: string) => /^\/(settings|control-panel)(\/|$)/.test(pathname);

/** App shell: server rail on the left, routed view filling the rest, realtime socket behind it. */
export function DashboardLayout() {
  useSessionKeeper();
  const showRail = !isFullPage(useLocation().pathname);

  return (
    <RealtimeProvider>
      <VoiceProvider>
        <div className={`flex h-full min-w-0 flex-1 bg-background p-2 ${showRail ? "pl-0" : ""}`}>
          {showRail && <ServerRail />}
          <div className="flex min-h-0 min-w-0 flex-1 gap-2">
            <Outlet />
          </div>
        </div>
      </VoiceProvider>
    </RealtimeProvider>
  );
}
