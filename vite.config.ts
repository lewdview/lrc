import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin route to the release CDN so the waveform can decode the audio
    // (production does this with a rewrite in vercel.json).
    proxy: {
      '/media': {
        target: 'https://files.th3scr1b3.art',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media/, ''),
      },
    },
  },
})
