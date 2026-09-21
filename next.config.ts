import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // unpdf and linkedom are Node-only and should not be bundled by Turbopack.
  serverExternalPackages: ['unpdf', 'linkedom', '@mozilla/readability'],
  agentRules: false,
}

export default nextConfig
