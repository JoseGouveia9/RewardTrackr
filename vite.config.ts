import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
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
      "/gomining-api": {
        target: "https://api.gomining.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gomining-api/, ""),
      },
    },
  },
});
