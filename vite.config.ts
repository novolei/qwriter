import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ["react-screenshots", "tesseract.js", "fflate"] },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**", "**/public/ocr/**"],
      // Windows editors/formatters can briefly truncate files before writing them.
      // Wait for a stable write so HMR never caches that intermediate empty module.
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ["@tiptap/react", "@tiptap/starter-kit", "@tiptap/markdown"],
        },
      },
    },
  },
  clearScreen: false,
});
