import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Read the client's package.json once at config time so we can
// inject the version into the bundle as a compile-time constant.
// Settings → Client surfaces this so the user always knows which
// build they're on; bug reports can quote it precisely. Synchronous
// + cheap (one fs read at config load) so it doesn't slow dev start.
const pkgJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
) as { version?: string };
const PB_CLIENT_VERSION = pkgJson.version ?? "0.0.0";

export default defineConfig(() => {
  const isWsl =
    process.platform === "linux" && Boolean(process.env.WSL_DISTRO_NAME);
  const cacheDir = isWsl
    ? path.join(os.tmpdir(), "pufferblow-vite-cache")
    : ".vite-cache";

  return {
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    // Inject the client version as a global at compile time. The
    // global is JSON.stringify-ed so the resulting bundle has a
    // literal "1.0.0" (not a JS identifier). Settings → Client
    // reads it via `import.meta.env.VITE_APP_VERSION`.
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(PB_CLIENT_VERSION),
    },
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "@tanstack/react-query"],
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      hmr: {
        host: "localhost",
        protocol: "ws",
        port: 5173,
        clientPort: 5173,
      },
      warmup: {
        clientFiles: [
          "./app/root.tsx",
          "./app/app.css",
          "./app/routes/home.tsx",
          "./app/routes/login.tsx",
          "./app/routes/signup.tsx",
          "./app/routes/dashboard.tsx",
          "./app/routes/settings.tsx",
          "./app/routes/control-panel.tsx",
          "./app/components/pages/DashboardPage.tsx",
          "./app/components/pages/SettingsPage.tsx",
          "./app/components/pages/ControlPanelPage.tsx",
        ],
      },
      // Don't proxy API requests - let the client make direct requests to the server
      // using the host:port stored in cookies for decentralized infrastructure
    },
    base: "/",
    cacheDir,
  };
});
