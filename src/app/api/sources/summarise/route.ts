import { MODELS, chat, jsonError } from '@/server/openrouter'
import { PROMPTS, contextBlock } from '@/server/prompts'
import type { ContextInput } from '@/server/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

type Body = {
  source: { title: string; authors: string[]; year: string; text: string }
  context: ContextInput
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    if (!body?.source?.text) return Response.json({ error: 'No source text to summarise.' }, { status: 400 })

    const text = body.source.text.length > 60_000 ? `${body.source.text.slice(0, 60_000)}\n[truncated]` : body.source.text
    const result = await chat({
      model: MODELS.cheap,
      maxTokens: 600,
      temperature: 0.3,
      messages: [
        { role: 'system', content: PROMPTS.sourceSummary },
        {
          role: 'user',
          content: `${contextBlock(body.context)}\n\n<source title="${body.source.title}" authors="${body.source.authors.join('; ')}" year="${body.source.year}">\n${text}\n</source>\n\nSummarise this source for the student's task.`,
        },
      ],
    })
    return Response.json({ summary: result.content.trim() })
  } catch (error) {
    return jsonError(error)
  }
}
