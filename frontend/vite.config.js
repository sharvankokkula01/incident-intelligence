import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// envDir '..' lets the single root .env supply VITE_API_BASE_URL. Only VITE_-prefixed
// variables are ever exposed to the browser; backend secrets are never bundled.
export default defineConfig({ plugins: [react()], envDir: '..', server: { port: 5173 } })
