import { MODELS } from '@/server/openrouter'

export const runtime = 'nodejs'

export async function GET() {
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY)
  return Response.json({ ok: hasKey, hasKey, models: MODELS })
}
