import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/adoption-guide/', // GitHub Pages path: spier-project.github.io/adoption-guide/
  // Honor a PORT assigned by the environment (e.g. a preview harness) so the
  // dev server binds where callers expect it; otherwise Vite's default 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
