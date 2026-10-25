import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { createAppQueryClient } from "./features/instance/queryClient";
import { AssetUrlContext, PreloadGate } from "@pufferblow/spines";
import { resolveAssetUrl } from "./services/authed";
import "./styles/app.css";

const queryClient = createAppQueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <PreloadGate>
      <QueryClientProvider client={queryClient}>
        {/* Pictures the instance serves (a role badge's image) are addressed by the app, not the design package. */}
        <AssetUrlContext.Provider value={resolveAssetUrl}>
          <RouterProvider router={router} />
        </AssetUrlContext.Provider>
      </QueryClientProvider>
    </PreloadGate>
  </StrictMode>,
);
