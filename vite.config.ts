import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "MAZI_");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${env.MAZI_API_PORT || "8005"}`,
          changeOrigin: false,
        },
        "/health": {
          target: `http://127.0.0.1:${env.MAZI_API_PORT || "8005"}`,
          changeOrigin: false,
        },
        "/land.geojson": {
          target: `http://127.0.0.1:${env.MAZI_API_PORT || "8005"}`,
          changeOrigin: false,
        },
      },
    },
  };
});
