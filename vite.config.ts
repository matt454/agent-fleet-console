import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiPort = process.env.HERMES_CONSOLE_API_PORT || "5180";
const devHost = process.env.HERMES_CONSOLE_DEV_HOST || "0.0.0.0";
const frontendPort = Number(process.env.HERMES_CONSOLE_DEV_FRONTEND_PORT || 5200);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: devHost,
    port: frontendPort,
    watch: {
      usePolling: false,
    },
    hmr: {
      protocol: "ws",
      ...(process.env.HERMES_CONSOLE_DEV_HMR_HOST ? { host: process.env.HERMES_CONSOLE_DEV_HMR_HOST } : {}),
      port: frontendPort,
    },
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
