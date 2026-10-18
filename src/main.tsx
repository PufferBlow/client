import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { createAppQueryClient } from "./features/instance/queryClient";
import { PreloadGate } from "./components/ui/Preload";
import "./styles/app.css";

const queryClient = createAppQueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <PreloadGate>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </PreloadGate>
  </StrictMode>,
);
