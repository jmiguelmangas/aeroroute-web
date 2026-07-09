import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // maplibre-gl is the single heaviest dependency; isolating it in its
        // own vendor chunk keeps it out of the app bundle and lets browsers
        // cache it independently of application code.
        manualChunks(id: string) {
          if (id.includes("node_modules/maplibre-gl")) {
            return "maplibre";
          }
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router-dom") ||
            id.includes("node_modules/react/")
          ) {
            return "react-vendor";
          }
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "query-vendor";
          }
          return undefined;
        },
      },
    },
    // maplibre-gl alone minifies to ~1.03 MB; it is already isolated into its
    // own vendor chunk above (nothing app-specific bundled with it) and has
    // no further internal split points, so the default 500 kB warning is
    // raised to accommodate this one legitimately large third-party chunk.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    exclude: ["**/._*", "e2e/**", "node_modules/**", "dist/**"],
  },
});
