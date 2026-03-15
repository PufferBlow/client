import os from "node:os";
import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  const isWsl =
    process.platform === "linux" && Boolean(process.env.WSL_DISTRO_NAME);
  const cacheDir = isWsl
    ? path.join(os.tmpdir(), "pufferblow-vite-cache")
    : ".vite-cache";

  return {
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
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
        clientFiles: ["./app/root.tsx", "./app/app.css"],
      },
      // Don't proxy API requests - let the client make direct requests to the server
      // using the host:port stored in cookies for decentralized infrastructure
    },
    base: "/",
    cacheDir,
  };
});
