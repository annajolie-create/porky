import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { findParagraph } from './paragraphIds'
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
    if (node.type.name === 'paragraph' && node.attrs.sectionId === sectionId && node.textContent.trim()) {
      target = node.attrs.id as string
      return false
    }
    return true
  })
  return target ? scrollToParagraph(editor, target) : false
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
    if (node.type.name === 'paragraph' && node.attrs.id) ids.push(node.attrs.id as string)
  })
  return ids
}

/** Last paragraph id of a section, or the last paragraph in the doc. */
export function lastParagraphOfSection(editor: Editor, sectionId: string | null): string | null {
  let last: string | null = null
  let lastAny: string | null = null
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'paragraph') return
    lastAny = node.attrs.id as string
    if (sectionId && node.attrs.sectionId === sectionId) last = node.attrs.id as string
  })
  return last ?? lastAny
}
