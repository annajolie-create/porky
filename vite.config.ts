import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import { createAssistantHandler } from './server/assistant.ts'

const ENDPOINT = '/api/assistant'

/**
 * Mounts the Claude endpoint in Node so the API key never reaches the browser
 * bundle. Registered on both the dev and preview servers; a static production
 * build has no Node process and would need a real backend.
 */
function assistantPlugin(apiKey: string | undefined): Plugin {
  const handler = createAssistantHandler(apiKey)

  const middleware = {
    configureServer(server: { middlewares: { use: (path: string, fn: unknown) => void } }) {
      server.middlewares.use(ENDPOINT, handler)
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, fn: unknown) => void } }) {
      server.middlewares.use(ENDPOINT, handler)
    },
  }

  return {
    name: 'porky-assistant',
    ...middleware,
  } as Plugin
}

export default defineConfig(({ mode }) => {
  // Third argument '' loads every variable, not only the VITE_ prefixed ones.
  // Because ANTHROPIC_API_KEY has no VITE_ prefix it stays server-side.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), assistantPlugin(env.ANTHROPIC_API_KEY)],
  }
})
