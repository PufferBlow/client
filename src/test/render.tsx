import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { AssetUrlContext } from "@pufferblow/spines";
import { resolveAssetUrl } from "../services/authed";
import { MessageCommandsContext } from "../features/realtime/commandsContext";
import type { MessageCommands } from "../features/realtime/messageCommands";
import userEvent from "@testing-library/user-event";

interface Options {
  /** Initial URL for the in-memory router. */
  route?: string;
  /** Route pattern the element is mounted at (needed for `useParams`); defaults to the route's pathname. */
  path?: string;
  queryClient?: QueryClient;
  /** Socket commands for edit, delete and reactions (the only way to do those). */
  commands?: Partial<MessageCommands>;
}

/** Fallback route: shows where navigation ended up as `pathname?search`. */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="elsewhere">{pathname + search}</div>;
}

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
}

/** Render with a router and query client; extra routes make navigation assertable. */
export function renderWithProviders(ui: ReactElement, { route = "/", path, queryClient = createTestQueryClient(), commands }: Options = {}) {
  const mountPath = path ?? new URL(route, "http://test.local").pathname;
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AssetUrlContext.Provider value={resolveAssetUrl}>
        <MessageCommandsContext.Provider value={(commands as MessageCommands | undefined) ?? null}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={mountPath} element={ui} />
              <Route path="*" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </MessageCommandsContext.Provider>
      </AssetUrlContext.Provider>
    </QueryClientProvider>,
  );
  return { user, queryClient, ...utils };
}
