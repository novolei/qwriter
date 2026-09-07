import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ["react-screenshots", "tesseract.js", "fflate"] },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**", "**/public/ocr/**"] },
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
