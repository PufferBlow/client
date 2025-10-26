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
    // In Electron development, don't proxy to avoid issues
    proxy: mode !== 'electron' ? {
      '/api': {
        target: 'http://localhost:7575',
        changeOrigin: true,
        secure: false,
      },
    } : undefined,
  },
  base: mode === 'electron' ? './' : '/',
  cacheDir: '.vite-cache',
}));
