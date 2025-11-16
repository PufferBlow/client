import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  build: {
    // For Electron, use absolute paths
    rollupOptions: mode === 'electron' ? {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    } : undefined
  },
  server: {
    // Don't proxy API requests - let the client make direct requests to the server
    // using the host:port stored in cookies for decentralized infrastructure
  },
  base: mode === 'electron' ? './' : '/',
  cacheDir: '.vite-cache',
}));
