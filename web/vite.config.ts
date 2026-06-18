import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/adoption-guide/', // GitHub Pages path: spier-project.github.io/adoption-guide/
})
