import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is env-driven so one codebase serves at the domain root (Cloudflare and
// local dev — the default `/`) and under /adoption-guide/ (legacy GitHub Pages,
// whose deploy workflow sets VITE_BASE). In-app asset + IG links read
// import.meta.env.BASE_URL, so they follow whichever base is active.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  // Honor a PORT assigned by the environment (e.g. a preview harness) so the
  // dev server binds where callers expect it; otherwise Vite's default 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
