import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // unpdf and linkedom are Node-only and should not be bundled by Turbopack.
  serverExternalPackages: [
    'unpdf',
    'linkedom',
    '@mozilla/readability',
    'nspell',
    'dictionary-en',
    'dictionary-de',
    'dictionary-es',
    'dictionary-fr',
    'dictionary-it',
    'dictionary-nl',
    'dictionary-pt',
  ],
  agentRules: false,
}

export default nextConfig
