import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["electron/main.ts", "electron/preload.ts"],
  format: ["cjs"],
  outDir: "dist-electron",
  external: ["electron"],
  sourcemap: true,
  clean: false,
  dts: false,
});
