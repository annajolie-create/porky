import { MODELS, chatJSON, decide, jsonError } from '@/server/openrouter'
import type { Question } from '@/server/openrouter'
import { PROMPTS, contextBlock, planBlock, sourcesBlock } from '@/server/prompts'
import type { ContextInput, PlanInput, SourceInput } from '@/server/prompts'
import { relevantPassages } from '@/lib/passages'
import type { CitationVerdict, FinalCheckReport } from '@/lib/model'
import { newId } from '@/lib/ids'

export const runtime = 'nodejs'
export const maxDuration = 120

type Paragraph = { id: string; sectionId: string | null; text: string; citations: string[] }

type Body = {
  context: ContextInput
  sources: (SourceInput & { text?: string })[]
  plan: PlanInput
  paragraphs: Paragraph[]
  title: string
  words: number
}

const schema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          paragraphId: { type: 'string' },
          claim: { type: 'string' },
          sourceId: { type: ['string', 'null'] },
          passage: { type: 'string' },
        },
        required: ['paragraphId', 'claim', 'sourceId', 'passage'],
        additionalProperties: false,
      },
    },
    missingCitations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          paragraphId: { type: 'string' },
          claim: { type: 'string' },
        },
        required: ['paragraphId', 'claim'],
        additionalProperties: false,
      },
    },
    answersQuestion: {
      type: 'object',
      properties: {
        verdict: { type: 'string' },
        strongest: { type: 'string' },
        weakest: { type: 'string' },
      },
      required: ['verdict', 'strongest', 'weakest'],
      additionalProperties: false,
    },
    planCoverage: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sectionId: { type: 'string' },
          status: { type: 'string', enum: ['covered', 'partial', 'missing'] },
          note: { type: 'string' },
        },
        required: ['sectionId', 'status', 'note'],
        additionalProperties: false,
      },
    },
    grading: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterion: { type: 'string' },
          verdict: { type: 'string' },
        },
        required: ['criterion', 'verdict'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'facts', 'missingCitations', 'answersQuestion', 'planCoverage', 'grading'],
  additionalProperties: false,
}

type Draft = {
  summary: string
  facts: { paragraphId: string; claim: string; sourceId: string | null; passage: string }[]
  missingCitations: { paragraphId: string; claim: string }[]
  answersQuestion: { verdict: string; strongest: string; weakest: string }
  planCoverage: { sectionId: string; status: 'covered' | 'partial' | 'missing'; note: string }[]
  grading: { criterion: string; verdict: string }[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const essay = body.paragraphs
      .filter((p) => p.text.trim())
      .map((p) => `<p id="${p.id}" section="${p.sectionId ?? ''}" cites="${p.citations.join(',')}">\n${p.text}\n</p>`)
      .join('\n\n')

    const draft = await chatJSON<Draft>({
      model: MODELS.strong,
      maxTokens: 6000,
      temperature: 0.2,
      jsonSchema: { name: 'final_check', schema },
      messages: [
        { role: 'system', content: PROMPTS.finalCheck },
        {
          role: 'user',
          content: [
            contextBlock(body.context),
            planBlock(body.plan),
            sourcesBlock(body.sources, { includeText: true, maxCharsEach: 8000 }),
            `<essay title="${body.title}">\n${essay}\n</essay>`,
            `Word count: ${body.words} of ${body.context.lengthWords ?? 'unspecified'} target.`,
          ].join('\n\n'),
        },
      ],
    })

    const facts = await judgeFacts(draft.facts ?? [], body.sources)
    const citations = await judgeCitations(body.paragraphs, body.sources)

    const counts = {
      facts: tally(facts.map((f) => (f.verdict === 'supported' ? 'ok' : f.verdict === 'weak' ? 'warn' : 'bad'))),
      citations: tally(citations.map((c) => (c.verdict === 'fits' ? 'ok' : c.verdict === 'weak' ? 'warn' : 'bad'))),
      missing: { ok: 0, warn: 0, bad: (draft.missingCitations ?? []).length },
      coverage: tally(
        (draft.planCoverage ?? []).map((c) => (c.status === 'covered' ? 'ok' : c.status === 'partial' ? 'warn' : 'bad')),
      ),
    }

    const report: FinalCheckReport = {
      createdAt: Date.now(),
      summary: draft.summary ?? '',
      counts,
      facts,
      citations,
      missingCitations: (draft.missingCitations ?? []).map((m) => ({ ...m, id: newId('miss') })),
      answersQuestion: draft.answersQuestion,
      planCoverage: draft.planCoverage ?? [],
      length: { words: body.words, target: body.context.lengthWords ?? null },
      grading: draft.grading ?? [],
    }
    return Response.json(report)
  } catch (error) {
    return jsonError(error)
  }
}

function tally(values: ('ok' | 'warn' | 'bad')[]): { ok: number; warn: number; bad: number } {
  const out = { ok: 0, warn: 0, bad: 0 }
  for (const v of values) out[v]++
  return out
}

async function judgeFacts(
  facts: Draft['facts'],
  sources: Body['sources'],
): Promise<FinalCheckReport['facts']> {
  const out: FinalCheckReport['facts'] = []
  const BATCH = 6
  for (let i = 0; i < facts.length; i += BATCH) {
    const batch = facts.slice(i, i + BATCH)
    const questions: Record<string, Question> = {}
    const state: Record<string, unknown> = {}
    batch.forEach((fact, j) => {
      const source = sources.find((s) => s.id === fact.sourceId)
      const passages = source?.text ? relevantPassages(source.text, fact.claim, 3) : fact.passage ? [fact.passage] : []
      const key = `f${j}`
      state[key] = { claim: fact.claim, passages }
      questions[key] = {
        type: 'choice',
        instructions: `Is claim ${key}.claim supported by ${key}.passages?`,
        criteria: {
          supported: 'The passages state or clearly imply the claim',
          weak: 'Related, but the specific claim is not established',
          unsupported: 'The passages do not support the claim, or there are no passages',
        },
      }
    })
    const { answers } = await decide(state, questions)
    batch.forEach((fact, j) => {
      const answer = answers[`f${j}`]
      const verdict =
        answer?.type === 'choice' && ['supported', 'weak', 'unsupported'].includes(answer.choice)
          ? (answer.choice as 'supported' | 'weak' | 'unsupported')
          : fact.sourceId
            ? 'weak'
            : 'unsupported'
      out.push({ id: newId('fact'), ...fact, verdict })
    })
  }
  return out
}

async function judgeCitations(
  paragraphs: Paragraph[],
  sources: Body['sources'],
): Promise<FinalCheckReport['citations']> {
  const items: { paragraphId: string; sourceId: string; sentence: string }[] = []
  for (const p of paragraphs) {
    for (const sourceId of p.citations) {
      items.push({ paragraphId: p.id, sourceId, sentence: p.text })
    }
  }
  const out: FinalCheckReport['citations'] = []
  const BATCH = 6
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    const questions: Record<string, Question> = {}
    const state: Record<string, unknown> = {}
    batch.forEach((item, j) => {
      const source = sources.find((s) => s.id === item.sourceId)
      const key = `c${j}`
      state[key] = {
        sentence: item.sentence,
        passages: source?.text ? relevantPassages(source.text, item.sentence, 3) : [],
      }
      questions[key] = {
        type: 'choice',
        instructions: `Does the source support this sentence?`,
        criteria: {
          fits: 'The passages support the sentence',
          weak: 'Only loosely related',
          'no-fit': 'Does not support the sentence',
        },
      }
    })
    const { answers } = await decide(state, questions)
    batch.forEach((item, j) => {
      const answer = answers[`c${j}`]
      const verdict = (
        answer?.type === 'choice' && ['fits', 'weak', 'no-fit'].includes(answer.choice) ? answer.choice : 'weak'
      ) as CitationVerdict
      out.push({ id: newId('cite'), ...item, verdict })
    })
  }
  return out
}
