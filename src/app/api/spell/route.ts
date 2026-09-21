import { jsonError } from '@/server/openrouter'
import { checkWords } from '@/server/spell'

export const runtime = 'nodejs'

type Body = {
  language?: string
  words?: string[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const words = Array.isArray(body.words) ? body.words.filter((w) => typeof w === 'string') : []
    if (!words.length) return Response.json({ misses: {} })
    const misses = await checkWords(body.language || 'English', words)
    return Response.json({ misses })
  } catch (error) {
    return jsonError(error)
  }
}
