import { MODELS } from '@/server/openrouter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY?.trim())
  return Response.json(
    { ok: hasKey, hasKey, models: MODELS },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
