import { inTextCitation } from './apa'
import type { Context, PlanNode, Source } from './model'

/** Shapes the client sends to route handlers; mirrors the server's prompt inputs. */

export function contextPayload(context: Context) {
  return {
    task: context.task,
    framework: context.framework,
    grading: context.grading,
    lengthWords: context.lengthWords,
    style: context.style,
    language: context.language,
  }
}

export function sourcesPayload(sources: Source[], options: { text?: boolean } = {}) {
  return sources.map((s) => ({
    id: s.id,
    title: s.title,
    authors: s.authors,
    year: s.year,
    citation: inTextCitation(s),
    summary: s.summary,
    text: options.text ? s.text : undefined,
  }))
}

export function planPayload(plan: PlanNode[]) {
  return plan.map((n) => ({
    id: n.id,
    title: n.title,
    claim: n.claim,
    keyPoints: n.keyPoints,
    evidence: n.evidence.map((e) => ({ text: e.text, sourceId: e.sourceId })),
    targetWords: n.targetWords,
  }))
}
