import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // served from https://<user>.github.io/smb-web-editor/
  base: '/smb-web-editor/',
})
