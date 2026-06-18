import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/memory-archive/",
  plugins: [react()],
  server: {
    port: 5173,
  },
});

