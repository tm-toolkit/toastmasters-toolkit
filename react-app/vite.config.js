import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base matches the GitHub Pages project-page path: tm-toolkit.github.io/toastmasters-toolkit/
export default defineConfig({
  plugins: [react()],
  base: '/toastmasters-toolkit/',
})
