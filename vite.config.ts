import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    // Only active in CI when SENTRY_AUTH_TOKEN is set; no-ops locally.
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
    }),
  ],
  build: {
    sourcemap: true,
  },
  base: "./",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      // In local dev, proxy /gomining-api/* → https://api.gomining.com/*
      // This bypasses CORS since the request originates from the Node server, not the browser.
      "/gomining-api/se": {
        target: "https://api.se.gomining.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gomining-api\/se/, ""),
      },
      "/gomining-api": {
        target: "https://api.gomining.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gomining-api/, ""),
      },
    },
  },
});
