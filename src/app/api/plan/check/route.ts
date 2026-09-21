import { decide, jsonError } from '@/server/openrouter'
import type { Question } from '@/server/openrouter'

export const runtime = 'nodejs'
export const maxDuration = 60

type EvidenceItem = {
  nodeId: string
  evidenceId: string
  claim: string
  sourceTitle: string
  passages: string[]
}

type Body = {
  task: string
  planSummary: string
  items: EvidenceItem[]
}

export type PlanCheckResult = {
  answersTask: { probability: number }
  evidence: { nodeId: string; evidenceId: string; supported: number }[]
}

const BATCH = 8
const MAX_PASSAGE_CHARS = 1400

/**
 * Plan-level correctness: is each evidence item actually supported by the
 * passages from its linked source, and does the plan answer the task?
 * Jev judges each claim-passage pair; batches keep requests under 32K tokens.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const items = body.items ?? []

    const taskCheck = decide(
      { task: body.task, plan: body.planSummary },
      {
        answers: {
          type: 'noul',
          instructions: 'Does this plan, if written well, fully answer the task? Consider scope, position and whether every part of the question is addressed.',
          criteria: { true: 'Every part of the task is covered and the plan takes a position where the task asks for one', false: 'A part of the task is missing, or the plan drifts to a different question' },
        },
      },
    )

    const evidence: PlanCheckResult['evidence'] = []
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH)
      const state: Record<string, unknown> = {}
      const questions: Record<string, Question> = {}
      batch.forEach((item, j) => {
        const key = `e${j}`
        state[key] = {
          claim: item.claim,
          source: item.sourceTitle,
          passages: item.passages.map((p) => p.slice(0, MAX_PASSAGE_CHARS)),
        }
        questions[key] = {
          type: 'noul',
          instructions: `Do the passages in ${key}.passages support the claim in ${key}.claim?`,
          criteria: {
            true: 'The passages state or clearly imply the claim',
            false: 'The passages do not mention it, contradict it, or only touch the topic loosely',
          },
        }
      })
      const { answers } = await decide(state, questions)
      batch.forEach((item, j) => {
        const answer = answers[`e${j}`]
        evidence.push({ nodeId: item.nodeId, evidenceId: item.evidenceId, supported: answer?.type === 'noul' ? answer.noul : 0.5 })
      })
    }

    const task = await taskCheck
    const answersTask = task.answers.answers
    const result: PlanCheckResult = {
      answersTask: { probability: answersTask?.type === 'noul' ? answersTask.noul : 0.5 },
      evidence,
    }
    return Response.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
