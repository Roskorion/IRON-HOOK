import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Относительные пути позволяют размещать сборку в подпапке GitHub Pages.
  base: './',
})
