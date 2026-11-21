import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In dev, /api is proxied to the FastAPI backend, so no CORS setup is needed.
// Point it elsewhere with VITE_BACKEND_URL (e.g. http://192.168.1.20:8000).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.VITE_BACKEND_URL || "http://localhost:8000";
  return {
    plugins: [react(), tailwindcss()],
    // React + Recharts ≈ 820 kB minified, 240 kB gzipped: fine for this dashboard.
    build: { chunkSizeWarningLimit: 900 },
    server: {
      port: 5173,
      host: true,
      proxy: { "/api": { target: backend, changeOrigin: true } },
    },
    preview: {
      port: 4173,
      proxy: { "/api": { target: backend, changeOrigin: true } },
    },
  };
});
