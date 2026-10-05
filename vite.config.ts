import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative asset paths, so it works at username.github.io/<repo-name>/
  plugins: [react(), tailwindcss()],
})
