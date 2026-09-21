import type { JSONContent } from '@tiptap/core'

/**
 * The single data model. Every tab, the agent, the checkers and the export
 * read from a Project; nothing keeps a private copy of this state.
 */

export type EssayStyle = 'academic' | 'personal' | 'business' | 'other'

export type ReferencePiece = {
  id: string
  name: string
  text: string
}

export type Context = {
  task: string
  framework: string
  grading: string
  lengthWords: number | null
  style: EssayStyle
  language: string
  referencePieces: ReferencePiece[]
}

export type SourceType = 'pdf' | 'link'

export type Source = {
  id: string
  type: SourceType
  title: string
  authors: string[]
  year: string
  url?: string
  /** Full extracted text; a handful of short PDFs fit in one model request. */
  text: string
  snippet: string
  summary?: string
  summaryStatus?: 'idle' | 'loading' | 'error'
  summaryError?: string
  addedAt: number
}

export type Evidence = {
  id: string
  text: string
  sourceId: string | null
}

export type PlanFlag = {
  id: string
  kind: 'evidence' | 'task' | 'order' | 'fit'
  message: string
  /** Set for evidence flags. */
  evidenceId?: string
}

export type PlanNode = {
  id: string
  title: string
  claim: string
  keyPoints: string[]
  evidence: Evidence[]
  targetWords: number | null
  flags: PlanFlag[]
}

export type PlanChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type SuggestionKind = 'edit' | 'insert'

export type Suggestion = {
  id: string
  kind: SuggestionKind
  /** Paragraph being edited, or the freshly inserted paragraph. */
  paragraphId: string
  sectionId: string | null
  oldText: string
  newText: string
  /** Original paragraph JSON so Reject restores formatting exactly. */
  originalContent: JSONContent | null
  /** For inserts: where the paragraph was placed; null means at the start. */
  afterParagraphId?: string | null
  /** Short label shown in the agent panel, e.g. "Shortened paragraph". */
  label: string
  createdAt: number
}

export type CommentReply = {
  id: string
  author: 'student' | 'agent'
  text: string
  createdAt: number
}

export type Comment = {
  id: string
  paragraphId: string
  quote: string
  author: 'student' | 'agent'
  text: string
  replies: CommentReply[]
  resolved: boolean
  createdAt: number
}

export type CitationVerdict = 'fits' | 'weak' | 'no-fit'

export type CheckerFlag = {
  paragraphId: string
  planFit?: { probability: number; reason: string }
  rambling?: { probability: number; reason: string }
  citationFit?: { sourceId: string; verdict: CitationVerdict; reason: string }
  /** Section Jev thinks the paragraph belongs to when it does not fit. */
  suggestedSectionId?: string | null
  dismissed: boolean
  /** Hash of the paragraph text the flag was computed for. */
  textHash: string
}

export type FinalCheckReport = {
  createdAt: number
  summary: string
  counts: Record<string, { ok: number; warn: number; bad: number }>
  facts: { id: string; paragraphId: string; claim: string; verdict: 'supported' | 'weak' | 'unsupported'; sourceId: string | null; passage: string }[]
  citations: { id: string; paragraphId: string; sourceId: string; sentence: string; verdict: CitationVerdict }[]
  missingCitations: { id: string; paragraphId: string; claim: string }[]
  answersQuestion: { verdict: string; strongest: string; weakest: string }
  planCoverage: { sectionId: string; status: 'covered' | 'partial' | 'missing'; note: string }[]
  length: { words: number; target: number | null }
  grading: { criterion: string; verdict: string }[]
}

export type Tab = 'context' | 'sources' | 'plan' | 'write' | 'check'

export type Project = {
  title: string
  context: Context
  sources: Source[]
  plan: PlanNode[]
  planChat: PlanChatMessage[]
  planStatus: 'empty' | 'asking' | 'ready'
  doc: JSONContent
  suggestions: Suggestion[]
  comments: Comment[]
  checkerFlags: Record<string, CheckerFlag>
  checkersEnabled: boolean
  report: FinalCheckReport | null
  /** Snapshot of context when the current plan was last accepted; used to detect drift. */
  planContextFingerprint: string | null
  updatedAt: number
}

/** Stable hash of the assignment fields the plan was built from. */
export function contextFingerprint(context: Context): string {
  return JSON.stringify({
    task: context.task.trim(),
    framework: context.framework.trim(),
    grading: context.grading.trim(),
    lengthWords: context.lengthWords,
    style: context.style,
    language: context.language,
    references: context.referencePieces.map((p) => `${p.id}:${p.name}`).join('|'),
  })
}

export const LANGUAGES = ['English', 'German', 'Spanish', 'French', 'Italian', 'Dutch', 'Portuguese'] as const

export const STYLES: { value: EssayStyle; label: string }[] = [
  { value: 'academic', label: 'Academic' },
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
]

export function emptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

export function defaultProject(): Project {
  return {
    title: '',
    context: {
      task: '',
      framework: '',
      grading: '',
      lengthWords: 2000,
      style: 'academic',
      language: 'English',
      referencePieces: [],
    },
    sources: [],
    plan: [],
    planChat: [],
    planStatus: 'empty',
    doc: emptyDoc(),
    suggestions: [],
    comments: [],
    checkerFlags: {},
    checkersEnabled: true,
    report: null,
    planContextFingerprint: null,
    updatedAt: Date.now(),
  }
}
