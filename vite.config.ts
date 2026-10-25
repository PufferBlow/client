import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
    // @pufferblow/spines is a path dependency (a link to ../spines), and the folder it points at has its own
    // node_modules. Without this its components would load a second copy of React and these libraries, and hooks
    // would fail ("invalid hook call").
    dedupe: ["react", "react-dom", "lucide-react"],
  },
  server: {
    port: 5173,
    strictPort: true,
    // The dev server only serves files under the project by default. The spines package lives next to it
    // (its art, fonts' neighbours and components are read from there), so that folder is allowed too.
    fs: { allow: [resolve(__dirname), resolve(__dirname, "../spines")] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "electron/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx"],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Emoji artwork is ~3,700 small SVGs: keep them as files (loaded on demand) instead of
    // inlining each one as a data URI into the JavaScript bundle.
    assetsInlineLimit: (file) => (file.includes("@twemoji") ? false : undefined),
  },
});
