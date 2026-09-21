import { MODELS, chatJSON, jsonError } from '@/server/openrouter'
import type { ChatMessage } from '@/server/openrouter'
import { PROMPTS, contextBlock, planBlock, sourcesBlock } from '@/server/prompts'
import type { ContextInput, PlanInput, SourceInput } from '@/server/prompts'

export const runtime = 'nodejs'
export const maxDuration = 90

type Body = {
  messages: { role: 'user' | 'assistant'; content: string }[]
  context: ContextInput
  sources: SourceInput[]
  plan: PlanInput
  referenceNotes?: string
}

export type PlanReply = {
  type: 'questions' | 'plan' | 'reply'
  message: string
  questions: { id: string; prompt: string; placeholder: string }[] | null
  plan: {
    id: string
    title: string
    claim: string
    keyPoints: string[]
    evidence: { text: string; sourceId: string | null }[]
    targetWords: number | null
  }[] | null
}

const schema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['questions', 'plan', 'reply'] },
    message: { type: 'string', description: 'One-line intro for questions, or a short note on the argument for a plan.' },
    questions: {
      type: ['array', 'null'],
      description: 'Clarifying questions when type is questions; otherwise null.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          prompt: { type: 'string', description: 'The question to show on the form.' },
          placeholder: { type: 'string', description: 'Short hint for the kind of answer expected.' },
        },
        required: ['id', 'prompt', 'placeholder'],
        additionalProperties: false,
      },
    },
    plan: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Keep the existing id for a section you are keeping or revising; use "new" for a new section.' },
          title: { type: 'string' },
          claim: { type: 'string' },
          keyPoints: { type: 'array', items: { type: 'string' } },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                sourceId: { type: ['string', 'null'] },
              },
              required: ['text', 'sourceId'],
              additionalProperties: false,
            },
          },
          targetWords: { type: ['integer', 'null'] },
        },
        required: ['id', 'title', 'claim', 'keyPoints', 'evidence', 'targetWords'],
        additionalProperties: false,
      },
    },
  },
  required: ['type', 'message', 'questions', 'plan'],
  additionalProperties: false,
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const history = body.messages ?? []
    const hasPlan = body.plan?.length > 0

    const system = [
      PROMPTS.planCoach,
      '',
      'Reply as JSON with fields type, message, questions, plan.',
      '- type "questions": you are asking clarifying questions; fill questions (2 to 4 items) and set plan to null. message is a one-line intro only.',
      '- type "plan": you are proposing or revising the full plan; plan holds every section; questions is null.',
      '- type "reply": a short answer that changes nothing; plan and questions are null.',
      hasPlan
        ? 'A plan already exists. If the student asks for changes, return the full revised plan with type "plan", keeping ids of sections you retain.'
        : history.filter((m) => m.role === 'user').length <= 1
          ? 'This is the first turn: ask your clarifying questions now (type "questions"). Do not propose the plan yet.'
          : 'The student has answered your questions. Propose the full plan now (type "plan").',
      '',
      contextBlock(body.context),
      body.referenceNotes ? `<reference_pieces_note>${body.referenceNotes}</reference_pieces_note>` : '',
      sourcesBlock(body.sources, { includeText: true, maxCharsEach: 9000 }),
      planBlock(body.plan ?? []),
    ]
      .filter(Boolean)
      .join('\n')

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    ]

    const reply = await chatJSON<PlanReply>({
      model: MODELS.strong,
      messages,
      jsonSchema: { name: 'plan_reply', schema },
      maxTokens: 6000,
      temperature: 0.4,
    })

    return Response.json({
      type: reply.type,
      message: reply.message ?? '',
      questions: Array.isArray(reply.questions) ? reply.questions : null,
      plan: Array.isArray(reply.plan) ? reply.plan : null,
    })
  } catch (error) {
    return jsonError(error)
  }
}
