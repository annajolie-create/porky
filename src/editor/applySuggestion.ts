import type { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { diffWords } from 'diff'
import { contentFromText } from '@/lib/doc'
import { newId } from '@/lib/ids'
import type { Source, Suggestion } from '@/lib/model'
import { findParagraph } from './paragraphIds'
import { SUGGESTION_TX } from './suggestions'

/** Plain text of a paragraph, with citation nodes rendered as their APA labels. */
export function pmParagraphText(node: PMNode): string {
  let text = ''
  node.descendants((child) => {
    if (child.isText) text += child.text ?? ''
    else if (child.type.name === 'citation') text += String(child.attrs.label ?? '')
  })
  return text
}

function paragraphFromJSON(editor: Editor, attrs: Record<string, unknown>, content: JSONContent[]) {
  return editor.schema.nodeFromJSON({
    type: 'paragraph',
    attrs,
    content: content.length ? content : undefined,
  })
}

function dispatch(editor: Editor, apply: (tr: Transaction) => boolean, history: boolean): boolean {
  const tr = editor.state.tr
  if (!apply(tr)) return false
  tr.setMeta(SUGGESTION_TX, true)
  if (!history) tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
  return true
}

function markText(text: string, type: 'sgIns' | 'sgDel', suggestionId: string): JSONContent {
  return { type: 'text', text, marks: [{ type, attrs: { suggestionId } }] }
}

function withInsertMark(nodes: JSONContent[], suggestionId: string): JSONContent[] {
  return nodes.map((n) =>
    n.type === 'text' ? { ...n, marks: [...(n.marks ?? []), { type: 'sgIns', attrs: { suggestionId } }] } : n,
  )
}

function diffContent(oldText: string, newText: string, suggestionId: string, sources: Source[]): JSONContent[] {
  const parts = diffWords(oldText, newText)
  const content: JSONContent[] = []
  for (const part of parts) {
    if (!part.value) continue
    if (part.removed) content.push(markText(part.value, 'sgDel', suggestionId))
    else if (part.added) content.push(...withInsertMark(contentFromText(part.value, sources), suggestionId))
    else content.push(...contentFromText(part.value, sources))
  }
  return content
}

export function applyEditSuggestion(editor: Editor, suggestion: Suggestion, sources: Source[]): boolean {
  const found = findParagraph(editor.state.doc, suggestion.paragraphId)
  if (!found) return false
  const node = paragraphFromJSON(
    editor,
    { ...found.node.attrs, id: suggestion.paragraphId, sectionId: suggestion.sectionId ?? found.node.attrs.sectionId },
    diffContent(suggestion.oldText, suggestion.newText, suggestion.id, sources),
  )
  return dispatch(
    editor,
    (tr) => {
      tr.replaceWith(found.pos, found.pos + found.node.nodeSize, node)
      return true
    },
    false,
  )
}

export function applyInsertSuggestion(editor: Editor, suggestion: Suggestion, sources: Source[]): boolean {
  const content = withInsertMark(contentFromText(suggestion.newText, sources), suggestion.id)
  const attrs = {
    id: suggestion.paragraphId,
    sectionId: suggestion.sectionId,
  }
  const node = paragraphFromJSON(editor, attrs, content)

  return dispatch(
    editor,
    (tr) => {
      let insertAt = 0
      if (suggestion.afterParagraphId) {
        const after = findParagraph(tr.doc, suggestion.afterParagraphId)
        if (after) insertAt = after.pos + after.node.nodeSize
      }
      tr.insert(insertAt, node)
      return true
    },
    false,
  )
}

export function acceptSuggestion(editor: Editor, suggestion: Suggestion, sources: Source[]): boolean {
  const found = findParagraph(editor.state.doc, suggestion.paragraphId)
  if (!found) return false
  const node = paragraphFromJSON(
    editor,
    { ...found.node.attrs, id: suggestion.paragraphId, sectionId: suggestion.sectionId ?? found.node.attrs.sectionId },
    contentFromText(suggestion.newText, sources),
  )
  return dispatch(
    editor,
    (tr) => {
      tr.replaceWith(found.pos, found.pos + found.node.nodeSize, node)
      return true
    },
    true,
  )
}

export function rejectSuggestion(editor: Editor, suggestion: Suggestion): boolean {
  const found = findParagraph(editor.state.doc, suggestion.paragraphId)
  if (!found) return false

  if (suggestion.kind === 'insert') {
    return dispatch(
      editor,
      (tr) => {
        tr.delete(found.pos, found.pos + found.node.nodeSize)
        return true
      },
      false,
    )
  }

  const original = suggestion.originalContent
  if (!original) return false
  const node = editor.schema.nodeFromJSON(original)
  return dispatch(
    editor,
    (tr) => {
      tr.replaceWith(found.pos, found.pos + found.node.nodeSize, node)
      return true
    },
    false,
  )
}

export function replaceSuggestion(editor: Editor, suggestion: Suggestion, next: Suggestion, sources: Source[]): boolean {
  rejectSuggestion(editor, suggestion)
  if (next.kind === 'insert') return applyInsertSuggestion(editor, next, sources)
  return applyEditSuggestion(editor, next, sources)
}

export function makeEditSuggestion(args: {
  editor: Editor
  paragraphId: string
  newText: string
  label: string
}): Suggestion | null {
  const found = findParagraph(args.editor.state.doc, args.paragraphId)
  if (!found) return null
  const oldText = pmParagraphText(found.node)
  return {
    id: newId('sg'),
    kind: 'edit',
    paragraphId: args.paragraphId,
    sectionId: (found.node.attrs.sectionId as string | null) ?? null,
    oldText,
    newText: args.newText,
    originalContent: found.node.toJSON() as JSONContent,
    label: args.label,
    createdAt: Date.now(),
  }
}

export function makeInsertSuggestion(args: {
  afterParagraphId: string | null
  sectionId: string | null
  newText: string
  label: string
}): Suggestion {
  return {
    id: newId('sg'),
    kind: 'insert',
    paragraphId: newId('p'),
    sectionId: args.sectionId,
    oldText: '',
    newText: args.newText,
    originalContent: null,
    afterParagraphId: args.afterParagraphId,
    label: args.label,
    createdAt: Date.now(),
  }
}
