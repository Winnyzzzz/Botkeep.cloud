import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Freebuff requires HMR to remain disabled.
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
