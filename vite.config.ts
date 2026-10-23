import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
    }),
  ],
  build: {
    sourcemap: true,
    cssTarget: "chrome100",
  },
  base: "/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/gomining-api/se": {
        target: "https://api.se.gomining.com",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/gomining-api\/se/, ""),
      },
      "/gomining-api/bm": {
        target: "https://api.bonus-miner.gomining.com",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/gomining-api\/bm/, ""),
      },
      "/gomining-api": {
        target: "https://api.gomining.com",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/gomining-api/, ""),
      },
      "/mexc": {
        target: "https://api.mexc.com",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/mexc/, ""),
      },
    },
  },
});
