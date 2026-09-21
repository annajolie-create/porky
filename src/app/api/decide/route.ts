import { MODELS, chat, decide, jsonError } from '@/server/openrouter'
import type { Question } from '@/server/openrouter'
import { PROMPTS } from '@/server/prompts'
import type { CitationVerdict } from '@/lib/model'

export const runtime = 'nodejs'
export const maxDuration = 30

type Section = { id: string; title: string; claim: string; keyPoints?: string[] }

type Body = {
  paragraph: { id: string; text: string; sectionId: string | null }
  section?: Section | null
  sections?: Section[]
  citation?: { sourceId: string; title: string; sentence: string; passages: string[] }
}

export type DecideResponse = {
  planFit?: { probability: number; reason: string }
  rambling?: { probability: number; reason: string }
  suggestedSectionId?: string | null
  citationFit?: { sourceId: string; verdict: CitationVerdict; reason: string }
}

const FIT_LOW = 0.4
const RAMBLE_HIGH = 0.62
const ASSIGN_CONF = 0.55

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const paragraph = body.paragraph?.text?.trim() ?? ''
    if (!paragraph) return Response.json({} satisfies DecideResponse)

    const questions: Record<string, Question> = {
      fit: {
        type: 'noul',
        instructions: body.section
          ? `Does this paragraph belong in the section "${body.section.title}" whose claim is: ${body.section.claim}`
          : 'Does this paragraph stay on a single coherent point?',
        criteria: {
          true: 'The paragraph advances the section claim or its key points',
          false: 'The paragraph is about a different claim, or would fit another section better',
        },
      },
      ramble: {
        type: 'noul',
        instructions: 'Is this paragraph repetitive, off-point or padded with filler?',
        criteria: {
          true: 'It repeats itself, hedges without adding, or wanders off the point',
          false: 'Every sentence earns its place',
        },
      },
    }

    const state: Record<string, unknown> = {
      paragraph,
      section: body.section
        ? { title: body.section.title, claim: body.section.claim, keyPoints: body.section.keyPoints ?? [] }
        : null,
    }

    if (body.sections?.length && body.sections.length > 1) {
      const criteria: Record<string, string> = { none: 'Fits no listed section' }
      for (const s of body.sections) criteria[s.id] = `${s.title}: ${s.claim}`
      questions.assign = {
        type: 'choice',
        instructions: 'Which plan section does this paragraph belong to?',
        criteria,
      }
      state.sections = body.sections.map((s) => ({ id: s.id, title: s.title, claim: s.claim }))
    }

    if (body.citation) {
      questions.cite = {
        type: 'choice',
        instructions: `Does the cited source (“${body.citation.title}”) support this sentence: “${body.citation.sentence}”?`,
        criteria: {
          fits: 'The source passages state or clearly imply the sentence',
          weak: 'Related topic, but the specific claim is not in the passages',
          'no-fit': 'The source does not support the sentence, or contradicts it',
        },
      }
      state.citation = {
        sentence: body.citation.sentence,
        passages: body.citation.passages.slice(0, 4),
      }
    }

    const { answers } = await decide(state, questions, request.signal)

    const result: DecideResponse = {}
    const fit = answers.fit
    const ramble = answers.ramble
    if (fit?.type === 'noul') result.planFit = { probability: fit.noul, reason: '' }
    if (ramble?.type === 'noul') result.rambling = { probability: ramble.noul, reason: '' }

    const assign = answers.assign
    if (assign?.type === 'choice' && assign.confidence >= ASSIGN_CONF && assign.choice !== 'none') {
      result.suggestedSectionId = assign.choice
    }

    const cite = answers.cite
    if (cite?.type === 'choice' && body.citation) {
      const verdict = (['fits', 'weak', 'no-fit'].includes(cite.choice) ? cite.choice : 'weak') as CitationVerdict
      result.citationFit = { sourceId: body.citation.sourceId, verdict, reason: reasonForVerdict(verdict) }
    }

    const needFitReason = result.planFit && result.planFit.probability < FIT_LOW
    const needRambleReason = result.rambling && result.rambling.probability > RAMBLE_HIGH
    if (needFitReason || needRambleReason) {
      const reasons = await explain(paragraph, body.section ?? null, Boolean(needFitReason), Boolean(needRambleReason), request.signal)
      if (needFitReason && result.planFit) result.planFit.reason = reasons.fit || 'This paragraph does not match the section claim.'
      if (needRambleReason && result.rambling) result.rambling.reason = reasons.ramble || 'This paragraph feels padded or off-point.'
    }

    return Response.json(result)
  } catch (error) {
    return jsonError(error)
  }
}

function reasonForVerdict(verdict: CitationVerdict): string {
  if (verdict === 'fits') return 'The source supports this sentence.'
  if (verdict === 'weak') return 'The source is only loosely related.'
  return 'The source does not support this sentence.'
}

async function explain(
  paragraph: string,
  section: Section | null,
  fit: boolean,
  ramble: boolean,
  signal: AbortSignal,
): Promise<{ fit: string; ramble: string }> {
  try {
    const jobs: Promise<string>[] = []
    if (fit) {
      jobs.push(
        chat({
          model: MODELS.cheap,
          maxTokens: 60,
          temperature: 0.2,
          signal,
          messages: [
            { role: 'system', content: PROMPTS.planFitReason },
            {
              role: 'user',
              content: `Section: ${section?.title ?? '(none)'}\nClaim: ${section?.claim ?? '(none)'}\n\nParagraph:\n${paragraph}`,
            },
          ],
        }).then((r) => r.content.trim()),
      )
    } else jobs.push(Promise.resolve(''))
    if (ramble) {
      jobs.push(
        chat({
          model: MODELS.cheap,
          maxTokens: 60,
          temperature: 0.2,
          signal,
          messages: [
            { role: 'system', content: PROMPTS.ramblingReason },
            { role: 'user', content: paragraph },
          ],
        }).then((r) => r.content.trim()),
      )
    } else jobs.push(Promise.resolve(''))
    const [fitReason, rambleReason] = await Promise.all(jobs)
    return { fit: fitReason, ramble: rambleReason }
  } catch {
    return { fit: '', ramble: '' }
  }
}
