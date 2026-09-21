import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { newId } from '@/lib/ids'
import { findParagraph, isTextBlock, paragraphAt } from './paragraphIds'
import { SUGGESTION_TX } from './suggestions'

/** Scrolls to and places the caret at the start of a paragraph. */
export function scrollToParagraph(editor: Editor, paragraphId: string): boolean {
  const found = findParagraph(editor.state.doc, paragraphId)
  if (!found) return false
  const pos = found.pos + 1
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)).scrollIntoView())
  editor.view.focus()
  const dom = editor.view.nodeDOM(found.pos) as HTMLElement | null
  dom?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return true
}

/** Scrolls to the first paragraph of a section. */
export function scrollToSection(editor: Editor, sectionId: string): boolean {
  let target: string | null = null
  editor.state.doc.descendants((node) => {
    if (target) return false
    if (isTextBlock(node.type.name) && node.attrs.sectionId === sectionId && node.textContent.trim()) {
      target = node.attrs.id as string
      return false
    }
    return true
  })
  return target ? scrollToParagraph(editor, target) : false
}

type ParaHit = { node: PMNode; pos: number }

/**
 * Jump to a plan section to write: focuses an existing paragraph, or prepares
 * an empty one in the right place. Section structure stays off the page —
 * selecting a section only decides where new writing belongs.
 */
export function startWritingInSection(editor: Editor, sectionId: string, plan: { id: string }[]): boolean {
  const hit = sectionHits(editor, sectionId, plan)
  if (hit.firstInSection) {
    const empty = hit.lastInSection && !hit.lastInSection.node.textContent.trim() ? hit.lastInSection : null
    const target = empty ?? hit.firstInSection
    return scrollToParagraph(editor, target.node.attrs.id as string)
  }
  const current = paragraphAt(editor.state.doc, editor.state.selection.from)
  if (current && !current.node.textContent.trim()) {
    reassignParagraph(editor, current.node.attrs.id as string, sectionId)
    return scrollToParagraph(editor, current.node.attrs.id as string)
  }
  if (hit.lastAny && !hit.lastAny.node.textContent.trim()) {
    reassignParagraph(editor, hit.lastAny.node.attrs.id as string, sectionId)
    return scrollToParagraph(editor, hit.lastAny.node.attrs.id as string)
  }
  return insertEmptyParagraph(editor, insertPosForSection(hit), sectionId)
}

/** Always inserts a new empty paragraph at the end of a plan section. */
export function addParagraphInSection(editor: Editor, sectionId: string, plan: { id: string }[]): boolean {
  const hit = sectionHits(editor, sectionId, plan)
  const pos = hit.lastInSection ? hit.lastInSection.pos + hit.lastInSection.node.nodeSize : insertPosForSection(hit)
  return insertEmptyParagraph(editor, pos, sectionId)
}

function sectionHits(editor: Editor, sectionId: string, plan: { id: string }[]): {
  firstInSection: ParaHit | null
  lastInSection: ParaHit | null
  lastPrior: ParaHit | null
  firstLater: ParaHit | null
  lastAny: ParaHit | null
} {
  const planIndex = plan.findIndex((n) => n.id === sectionId)
  const prior = new Set(plan.slice(0, Math.max(0, planIndex)).map((n) => n.id))
  const later = new Set(plan.slice(planIndex + 1).map((n) => n.id))
  const hit: {
    firstInSection: ParaHit | null
    lastInSection: ParaHit | null
    lastPrior: ParaHit | null
    firstLater: ParaHit | null
    lastAny: ParaHit | null
  } = { firstInSection: null, lastInSection: null, lastPrior: null, firstLater: null, lastAny: null }
  editor.state.doc.descendants((node, pos) => {
    if (!isTextBlock(node.type.name)) return
    hit.lastAny = { node, pos }
    const sid = node.attrs.sectionId as string | null
    if (sid === sectionId) {
      if (!hit.firstInSection) hit.firstInSection = { node, pos }
      hit.lastInSection = { node, pos }
    } else if (sid && prior.has(sid)) {
      hit.lastPrior = { node, pos }
    } else if (!hit.firstLater && sid && later.has(sid)) {
      hit.firstLater = { node, pos }
    }
  })
  return hit
}

function insertPosForSection(hit: ReturnType<typeof sectionHits>): number {
  if (hit.lastPrior) return hit.lastPrior.pos + hit.lastPrior.node.nodeSize
  if (hit.firstLater) return hit.firstLater.pos
  if (hit.lastAny) return hit.lastAny.pos + hit.lastAny.node.nodeSize
  return 0
}

function insertEmptyParagraph(editor: Editor, pos: number, sectionId: string): boolean {
  const type = editor.schema.nodes.paragraph
  if (!type) return false
  const id = newId('p')
  const node = type.create({ id, sectionId })
  const tr = editor.state.tr.insert(pos, node)
  tr.setSelection(TextSelection.create(tr.doc, pos + 1))
  tr.setMeta(SUGGESTION_TX, true)
  editor.view.dispatch(tr)
  editor.view.focus()
  const dom = editor.view.nodeDOM(pos) as HTMLElement | null
  dom?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return true
}

/** Moves a paragraph to another plan section. */
export function reassignParagraph(editor: Editor, paragraphId: string, sectionId: string | null) {
  const found = findParagraph(editor.state.doc, paragraphId)
  if (!found) return
  const tr = editor.state.tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, sectionId })
  tr.setMeta(SUGGESTION_TX, true)
  editor.view.dispatch(tr)
}

/** Text of the current selection, or empty string. */
export function selectedText(editor: Editor): string {
  const { from, to } = editor.state.selection
  if (from === to) return ''
  return editor.state.doc.textBetween(from, to, '\n', (node) => (node.type.name === 'citation' ? (node.attrs.label as string) : ''))
}

/** Ids of paragraphs overlapping the current selection. */
export function selectedParagraphIds(editor: Editor): string[] {
  const { from, to } = editor.state.selection
  const ids: string[] = []
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (isTextBlock(node.type.name) && node.attrs.id) ids.push(node.attrs.id as string)
  })
  return ids
}

export type CapturedSelection = {
  text: string
  paragraphIds: string[]
  quotes: { paragraphId: string; quote: string }[]
}

/** Snapshot of a non-empty selection, including per-paragraph quotes for highlighting. */
export function captureSelection(editor: Editor): CapturedSelection | null {
  const { from, to } = editor.state.selection
  if (from === to) return null
  const leaf = (node: PMNode) => (node.type.name === 'citation' ? (node.attrs.label as string) : '')
  const text = editor.state.doc.textBetween(from, to, '\n', leaf).trim()
  if (!text) return null
  const quotes: { paragraphId: string; quote: string }[] = []
  const paragraphIds: string[] = []
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!isTextBlock(node.type.name) || !node.attrs.id) return
    const start = Math.max(from, pos + 1)
    const end = Math.min(to, pos + node.nodeSize - 1)
    if (end <= start) return
    const quote = editor.state.doc.textBetween(start, end, '\n', leaf)
    if (!quote) return
    paragraphIds.push(node.attrs.id as string)
    quotes.push({ paragraphId: node.attrs.id as string, quote })
  })
  return { text, paragraphIds, quotes }
}

/** Last paragraph id of a section, or the last paragraph in the doc. */
export function lastParagraphOfSection(editor: Editor, sectionId: string | null): string | null {
  let last: string | null = null
  let lastAny: string | null = null
  editor.state.doc.descendants((node) => {
    if (!isTextBlock(node.type.name)) return
    lastAny = node.attrs.id as string
    if (sectionId && node.attrs.sectionId === sectionId) last = node.attrs.id as string
  })
  return last ?? lastAny
}
