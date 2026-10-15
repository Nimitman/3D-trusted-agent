import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /3D-trusted-agent/, so production builds
// use that base path. Dev stays at the root. Override with BASE_PATH if needed.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.BASE_PATH ?? '/3D-trusted-agent/') : '/',
  plugins: [react()],
  server: { port: 5317 },
}))
