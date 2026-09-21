import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Paragraph-level classes driven by app state: checker results, the active
 * paragraph, locked paragraphs and comment anchors. State arrives through a
 * transaction meta so it never touches the document or history.
 */

export type ParagraphDecorationState = {
  /** paragraphId -> class names */
  classes: Record<string, string[]>
  /** Inline highlight ranges for comments: paragraphId -> quotes. */
  comments: { paragraphId: string; quote: string; commentId: string; active: boolean }[]
  /** Marked text pinned for the agent chat after the editor loses focus. */
  held?: { paragraphId: string; quote: string }[]
}

export const decorationsKey = new PluginKey<{ state: ParagraphDecorationState; set: DecorationSet }>('paragraphDecorations')

export const DECORATION_META = 'paragraphDecorations'

const EMPTY: ParagraphDecorationState = { classes: {}, comments: [], held: [] }

export const ParagraphDecorations = Extension.create({
  name: 'paragraphDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: decorationsKey,
        state: {
          init: (_, state) => ({ state: EMPTY, set: build(state.doc, EMPTY) }),
          apply: (tr, value, _old, newState) => {
            const incoming = tr.getMeta(DECORATION_META) as ParagraphDecorationState | undefined
            if (incoming) return { state: incoming, set: build(newState.doc, incoming) }
            if (tr.docChanged) return { state: value.state, set: build(newState.doc, value.state) }
            return value
          },
        },
        props: {
          decorations(state) {
            return decorationsKey.getState(state)?.set ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})

function build(doc: PMNode, state: ParagraphDecorationState): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return
    const id = node.attrs.id as string
    const classes = state.classes[id]
    if (classes?.length) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: classes.join(' ') }))
    }
    const comments = state.comments.filter((c) => c.paragraphId === id)
    if (comments.length) {
      const text = node.textContent
      for (const comment of comments) {
        const index = comment.quote ? text.indexOf(comment.quote) : -1
        if (index === -1) continue
        // Map text offset to document position across inline children.
        const from = offsetToPos(node, pos + 1, index)
        const to = offsetToPos(node, pos + 1, index + comment.quote.length)
        if (from !== null && to !== null && to > from) {
          decorations.push(
            Decoration.inline(from, to, {
              class: comment.active ? 'cm-anchor is-active' : 'cm-anchor',
              'data-comment': comment.commentId,
            }),
          )
        }
      }
    }
    const held = state.held?.filter((h) => h.paragraphId === id) ?? []
    if (held.length) {
      const text = node.textContent
      for (const mark of held) {
        const index = mark.quote ? text.indexOf(mark.quote) : -1
        if (index === -1) continue
        const from = offsetToPos(node, pos + 1, index)
        const to = offsetToPos(node, pos + 1, index + mark.quote.length)
        if (from !== null && to !== null && to > from) {
          decorations.push(Decoration.inline(from, to, { class: 'held-sel' }))
        }
      }
    }
  })
  return DecorationSet.create(doc, decorations)
}

function offsetToPos(paragraph: PMNode, start: number, offset: number): number | null {
  let remaining = offset
  let pos = start
  for (let i = 0; i < paragraph.childCount; i++) {
    const child = paragraph.child(i)
    const length = child.isText ? (child.text?.length ?? 0) : child.textContent.length || 1
    if (remaining <= length) {
      return child.isText ? pos + remaining : pos + (remaining === 0 ? 0 : child.nodeSize)
    }
    remaining -= length
    pos += child.nodeSize
  }
  return remaining === 0 ? pos : null
}
