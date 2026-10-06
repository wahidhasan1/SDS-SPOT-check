import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' + HashRouter lets the built app run from any static host or sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
