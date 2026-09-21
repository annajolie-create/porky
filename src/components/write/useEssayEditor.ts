'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { buildExtensions } from '@/editor/extensions'
import { DECORATION_META } from '@/editor/decorations'
import type { ParagraphDecorationState } from '@/editor/decorations'
import { paragraphAt } from '@/editor/paragraphIds'
import { scrollToParagraph } from '@/editor/commands'
import { useProject } from '@/lib/store'
import { inTextCitation } from '@/lib/apa'

/**
 * Creates the essay editor and keeps it in step with the project store:
 * the document is saved on a debounce, the active paragraph follows the
 * caret, and checker/suggestion/comment state is pushed in as decorations.
 */
export function useEssayEditor(): Editor | null {
  const initialDoc = useRef(useProject.getState().doc)
  const saveTimer = useRef<number | null>(null)

  const extensions = useMemo(
    () =>
      buildExtensions({
        defaultSectionId: () => useProject.getState().plan[0]?.id ?? null,
        lockedParagraphIds: () => new Set(useProject.getState().suggestions.map((s) => s.paragraphId)),
      }),
    [],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialDoc.current,
    editorProps: {
      attributes: { class: 'essay', 'aria-label': 'Essay', spellcheck: 'true' },
      transformPastedHTML: (html) => stripPastedHtml(html),
    },
    onUpdate: ({ editor }) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        useProject.getState().setDoc(editor.getJSON())
      }, 400)
    },
    onSelectionUpdate: ({ editor }) => {
      const found = paragraphAt(editor.state.doc, editor.state.selection.from)
      useProject.getState().setActiveParagraph((found?.node.attrs.id as string) ?? null)
    },
  })

  // Flush the debounce on unmount so switching tabs never loses the last words.
  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      if (editor && !editor.isDestroyed) useProject.getState().setDoc(editor.getJSON())
    }
  }, [editor])

  const pendingScrollParagraphId = useProject((s) => s.pendingScrollParagraphId)
  useEffect(() => {
    if (!editor || editor.isDestroyed || !pendingScrollParagraphId) return
    scrollToParagraph(editor, pendingScrollParagraphId)
    useProject.getState().setPendingScroll(null)
  }, [editor, pendingScrollParagraphId])

  // Decorations: checker classes, active paragraph, locked paragraphs, comment anchors.
  const checkerFlags = useProject((s) => s.checkerFlags)
  const checkersEnabled = useProject((s) => s.checkersEnabled)
  const activeParagraphId = useProject((s) => s.activeParagraphId)
  const suggestions = useProject((s) => s.suggestions)
  const comments = useProject((s) => s.comments)
  const activeCommentId = useProject((s) => s.activeCommentId)

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const classes: Record<string, string[]> = {}
    const push = (id: string, cls: string) => {
      ;(classes[id] ??= []).push(cls)
    }
    if (checkersEnabled) {
      for (const flag of Object.values(checkerFlags)) {
        if (flag.dismissed) continue
        if (flag.rambling) push(flag.paragraphId, 'ck-rambling')
        if (flag.planFit) push(flag.paragraphId, 'ck-planfit')
      }
    }
    if (activeParagraphId) push(activeParagraphId, 'is-active')
    for (const s of suggestions) push(s.paragraphId, 'is-locked')
    const state: ParagraphDecorationState = {
      classes,
      comments: comments
        .filter((c) => !c.resolved)
        .map((c) => ({ paragraphId: c.paragraphId, quote: c.quote, commentId: c.id, active: c.id === activeCommentId })),
    }
    editor.view.dispatch(editor.state.tr.setMeta(DECORATION_META, state).setMeta('addToHistory', false))
  }, [editor, checkerFlags, checkersEnabled, activeParagraphId, suggestions, comments, activeCommentId])

  // Keep citation labels current when the student edits author or year.
  const sources = useProject((s) => s.sources)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const labels: Record<string, string> = {}
    for (const s of sources) labels[s.id] = inTextCitation(s)
    editor.commands.relabelCitations(labels)
  }, [editor, sources])

  return editor
}

/** Keeps paragraphs, emphasis and lists from pasted HTML; drops everything else. */
function stripPastedHtml(html: string): string {
  if (typeof window === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'BLOCKQUOTE'])
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      walk(child)
      if (!allowed.has(child.tagName)) {
        const replacement = /^(DIV|H[1-6]|SECTION|ARTICLE)$/.test(child.tagName) ? doc.createElement('p') : null
        if (replacement) {
          while (child.firstChild) replacement.appendChild(child.firstChild)
          child.replaceWith(replacement)
        } else {
          child.replaceWith(...Array.from(child.childNodes))
        }
      } else {
        for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name)
      }
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}
