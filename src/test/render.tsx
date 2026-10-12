import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

interface Options {
  /** Initial URL for the in-memory router. */
  route?: string;
  /** Route pattern the element is mounted at (needed for `useParams`); defaults to the route's pathname. */
  path?: string;
  queryClient?: QueryClient;
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
export function renderWithProviders(ui: ReactElement, { route = "/", path, queryClient = createTestQueryClient() }: Options = {}) {
  const mountPath = path ?? new URL(route, "http://test.local").pathname;
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={mountPath} element={ui} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user, queryClient, ...utils };
}
