import { MODELS, chatJSON, decide, jsonError } from '@/server/openrouter'
import type { Question } from '@/server/openrouter'

export const runtime = 'nodejs'
export const maxDuration = 60

type Candidate = { sourceId: string; title: string; passage: string }

/**
 * Ranks candidate passages for a topic query. Jev answers "does this passage
 * discuss the topic?" per passage (batched); a cheap model writes the
 * one-line explanation for the survivors.
 */
export async function POST(request: Request) {
  try {
    const { query, candidates } = (await request.json()) as { query: string; candidates: Candidate[] }
    if (!query?.trim()) return Response.json({ error: 'No query.' }, { status: 400 })
    if (!candidates?.length) return Response.json({ results: [] })

    const limited = candidates.slice(0, 24)
    const questions: Record<string, Question> = {}
    const state: Record<string, unknown> = { topic: query, passages: {} }
    limited.forEach((c, i) => {
      const key = `p${i}`
      ;(state.passages as Record<string, string>)[key] = c.passage.slice(0, 1200)
      questions[key] = {
        type: 'noul',
        instructions: `Does passage ${key} substantively discuss the topic "${query}"?`,
        criteria: { true: 'The passage directly addresses the topic with specific content', false: 'The passage only shares a word or two or is about something else' },
      }
    })

    const { answers } = await decide(state, questions)
    const scored = limited
      .map((c, i) => ({ ...c, score: (answers[`p${i}`] as { noul: number })?.noul ?? 0 }))
      .filter((c) => c.score >= 0.55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)

    if (!scored.length) return Response.json({ results: [] })

    let explanations: string[] = []
    try {
      const schema = {
        type: 'object',
        properties: { explanations: { type: 'array', items: { type: 'string' } } },
        required: ['explanations'],
        additionalProperties: false,
      }
      const result = await chatJSON<{ explanations: string[] }>({
        model: MODELS.cheap,
        maxTokens: 500,
        jsonSchema: { name: 'explanations', schema },
        messages: [
          {
            role: 'user',
            content: `For each passage, write one short line (max 12 words) saying what it says about "${query}". Return the lines in order.\n\n${scored
              .map((c, i) => `[${i}] (${c.title})\n${c.passage.slice(0, 900)}`)
              .join('\n\n')}`,
          },
        ],
      })
      explanations = result.explanations ?? []
    } catch {
      explanations = []
    }

    return Response.json({
      results: scored.map((c, i) => ({
        sourceId: c.sourceId,
        passage: c.passage,
        score: c.score,
        explanation: explanations[i] ?? 'Discusses this topic',
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
