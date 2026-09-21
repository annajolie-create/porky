import 'server-only'

/**
 * Every prompt in one place so they can be tuned before the demo.
 * Context blocks are built with the helpers at the bottom.
 */

export const PROMPTS = {
  sourceMetadata: `You extract bibliographic metadata from the opening text of a document.
Return the title, the list of authors (full names as printed, in order) and the publication year.
If something is genuinely not present, return an empty string or list. Never guess an author from a URL or publisher name.`,

  sourceSummary: `You summarise a source for a student writing an essay.
Write 3 to 5 sentences in plain prose: what the source is, what it argues or finds, and specifically what it says that matters for the student's task.
If the source does not address the task at all, say so in one sentence and then summarise it briefly.
No headings, no bullet points, no preamble.`,

  planCoach: `You are a planning coach helping a student build the argument of an essay. You have read the student's task, grading scheme and sources.

Your job across this conversation:
1. On the first turn, ask 2 to 4 short clarifying questions in one message (for example: the position they want to take, scope, which counterarguments to cover, anything the sources do not settle). Number them.
2. Once the student has answered, propose a complete plan: an ordered list of sections. Each section has a title, a one- or two-sentence claim, 3 to 5 key points, and evidence items each linked to a source id from the list you were given. Only link evidence to a source that actually supports it; if no source covers a point, set sourceId to null and say so in the evidence text.
3. After a plan exists, when the student asks for changes, return the full revised plan.

Plans follow the essay's length: a 2,000 word essay usually has 5 to 7 sections including introduction and conclusion. Give each section a target word count that sums roughly to the total.
Write section titles the student will recognise ("Counterargument: privacy risks"), not generic labels.
Be concise. No flattery.`,

  agent: `You are the writing agent inside Porky, an essay editor. You sit in a panel next to the student's essay. You know the task, the plan, the sources and the document outline.

Rules:
- The student owns the argument. Follow the plan; if you think it is wrong, say so instead of quietly deviating.
- Never change the document directly. Use propose_edit to suggest a rewrite of a paragraph, and insert_paragraph to suggest new text. The student accepts or rejects.
- Only cite sources from the source list, in APA in-text form exactly as given (for example "(Smith, 2021)"). Every factual claim you write should be supported by a source passage; if the sources do not cover a point, say so rather than inventing support.
- Read only what you need: start from the outline, open a section or paragraph in full when you have to.
- When drafting a section, write it as one or more paragraphs with insert_paragraph, in order, assigned to that section. Match the student's register and language.
- When rewriting a paragraph, return the full new paragraph text via propose_edit, not a fragment.
- Keep chat replies short. After making proposals, one or two sentences on what you did and why is enough. Never paste the proposed text into the chat as well.`,

  ramblingReason: `In one short sentence (max 18 words), tell the student what makes this paragraph feel padded, repetitive or off-point. Be concrete; quote two or three words if useful. No preamble.`,

  planFitReason: `In one short sentence (max 18 words), tell the student why this paragraph does not fit the plan section it is assigned to. No preamble.`,

  finalCheck: `You are a strict but fair examiner producing a quality report on a student's essay. You have the task, grading scheme, plan and sources.
Extract every distinct factual claim (max 20), note which paragraph it is in and which source (if any) supports it and the supporting passage. Flag claims that need a source but have none.
Judge whether the essay answers the task, name the strongest and weakest part, and rate coverage of each plan section.
If a grading scheme is given, give a one-line verdict per criterion.
Be specific and quote the essay where it helps. Verdicts must be one of the allowed values.`,
}

// ---------------------------------------------------------------- context blocks

export type ContextInput = {
  task: string
  framework?: string
  grading?: string
  lengthWords?: number | null
  style?: string
  language?: string
}

export function contextBlock(context: ContextInput): string {
  const lines = [`<task>${context.task.trim() || '(no task given yet)'}</task>`]
  if (context.framework?.trim()) lines.push(`<framework>${context.framework.trim()}</framework>`)
  if (context.grading?.trim()) lines.push(`<grading_scheme>${context.grading.trim()}</grading_scheme>`)
  lines.push(
    `<requirements length="${context.lengthWords ?? 'unspecified'} words" style="${context.style ?? 'academic'}" language="${context.language ?? 'English'}" />`,
  )
  return lines.join('\n')
}

export type SourceInput = {
  id: string
  title: string
  authors: string[]
  year: string
  citation: string
  summary?: string
  text?: string
  maxChars?: number
}

export function sourcesBlock(sources: SourceInput[], options: { includeText?: boolean; maxCharsEach?: number } = {}): string {
  if (!sources.length) return '<sources>(no sources uploaded yet)</sources>'
  const parts = sources.map((s) => {
    const head = `<source id="${s.id}" cite="${s.citation}" title="${escape(s.title)}" authors="${escape(s.authors.join('; '))}" year="${s.year}">`
    const body: string[] = []
    if (s.summary) body.push(`<summary>${s.summary}</summary>`)
    if (options.includeText && s.text) {
      const max = options.maxCharsEach ?? 12000
      const text = s.text.length > max ? `${s.text.slice(0, max)}\n[...truncated]` : s.text
      body.push(`<text>\n${text}\n</text>`)
    }
    return `${head}\n${body.join('\n')}\n</source>`
  })
  return `<sources>\n${parts.join('\n')}\n</sources>`
}

export type PlanInput = {
  id: string
  title: string
  claim: string
  keyPoints: string[]
  evidence: { text: string; sourceId: string | null }[]
  targetWords: number | null
}[]

export function planBlock(plan: PlanInput): string {
  if (!plan.length) return '<plan>(no plan yet)</plan>'
  const parts = plan.map((n, i) => {
    const evidence = n.evidence.map((e) => `    - ${e.text}${e.sourceId ? ` [source ${e.sourceId}]` : ' [no source]'}`).join('\n')
    return `  <section id="${n.id}" index="${i + 1}" title="${escape(n.title)}" target_words="${n.targetWords ?? ''}">
    claim: ${n.claim}
    key points:\n${n.keyPoints.map((k) => `    - ${k}`).join('\n')}
    evidence:\n${evidence || '    (none)'}
  </section>`
  })
  return `<plan>\n${parts.join('\n')}\n</plan>`
}

function escape(text: string): string {
  return text.replace(/"/g, "'").replace(/</g, '‹').replace(/>/g, '›')
}
