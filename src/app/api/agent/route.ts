import { jsonError, sseResponse } from '@/server/openrouter'
import { runAgent, type AgentBody } from '@/server/agent'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentBody
    if (!body?.messages?.length) return Response.json({ error: 'No message to answer.' }, { status: 400 })
    return sseResponse((emit, signal) => runAgent(body, emit, signal), request)
  } catch (error) {
    return jsonError(error)
  }
}
