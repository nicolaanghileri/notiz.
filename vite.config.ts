import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Rust-Fehler in der Konsole nicht überschreiben.
  clearScreen: false,
  server: {
    // Muss zu build.devUrl in src-tauri/tauri.conf.json passen.
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
