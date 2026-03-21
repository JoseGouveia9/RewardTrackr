import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: {
      // In local dev, proxy /gomining-api/* → https://api.gomining.com/*
      // This bypasses CORS since the request originates from the Node server, not the browser.
      "/gomining-api": {
        target: "https://api.gomining.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gomining-api/, ""),
      },
    },
  },
});
