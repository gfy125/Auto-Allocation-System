import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
// Read frontendPort from project config.yml if present
function readFrontendPortFromConfig(): number | null {
  try {
    const cfgPath = path.resolve(__dirname, '../config.yml');
    if (!fs.existsSync(cfgPath)) return null;
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const m = raw.match(/frontendPort:\s*(\d+)/i);
    if (m) return Number(m[1]);
  } catch (_) {}
  return null;
}

const CONFIG_FRONTEND_PORT = readFrontendPortFromConfig();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // allow external access
    port: Number(process.env.VITE_FRONTEND_PORT || CONFIG_FRONTEND_PORT || 5173), // configurable port (env -> config.yml -> default)
    // strictPort ensures we don't silently switch when occupied (optional)
    // strictPort: true,
  },
})
