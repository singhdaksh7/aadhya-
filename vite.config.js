import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Must match server/.env FRONTEND_URL exactly (CORS + cookie origin).
    port: 5175,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    globals: true,
    // This directory has an unrelated nested project under .kilo/ — scope
    // Vitest strictly to our own test directory so it never picks that up.
    include: ["tests/**/*.{test,spec}.{js,jsx}"],
    exclude: ["node_modules", "server", ".kilo", "dist"],
  },
})
