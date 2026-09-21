import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { isTextBlock } from './paragraphIds'

/**
 * Agent edits appear as tracked changes: red strikethrough for deletions,
 * green for insertions, both tagged with the suggestion id. While a
 * suggestion is pending, its paragraph is locked for typing.
 */

export const SuggestionInsert = Mark.create({
  name: 'sgIns',
  inclusive: false,
  excludes: 'sgDel',
  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-sg'),
        renderHTML: (attrs) => ({ 'data-sg': attrs.suggestionId }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'ins[data-sg]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes(HTMLAttributes, { class: 'sg-ins' }), 0]
  },
})

export const SuggestionDelete = Mark.create({
  name: 'sgDel',
  inclusive: false,
  excludes: 'sgIns',
  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-sg'),
        renderHTML: (attrs) => ({ 'data-sg': attrs.suggestionId }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'del[data-sg]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['del', mergeAttributes(HTMLAttributes, { class: 'sg-del' }), 0]
  },
})

export type SuggestionLockOptions = {
  lockedParagraphIds: () => Set<string>
}

export const suggestionLockKey = new PluginKey('suggestionLock')

/** Meta flag a transaction sets to bypass the lock (accept/reject/apply). */
export const SUGGESTION_TX = 'suggestionTx'

export const SuggestionLock = Extension.create<SuggestionLockOptions>({
  name: 'suggestionLock',

  addOptions() {
    return { lockedParagraphIds: () => new Set<string>() }
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          locked: {
            default: false,
            rendered: false,
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: suggestionLockKey,
        filterTransaction: (tr: Transaction, state) => {
          if (!tr.docChanged || tr.getMeta(SUGGESTION_TX)) return true
          const locked = options.lockedParagraphIds()
          if (!locked.size) return true
          let blocked = false
          for (const step of tr.steps) {
            step.getMap().forEach((oldStart, oldEnd) => {
              if (blocked) return
              if (touchesLocked(state.doc, oldStart, oldEnd, locked)) blocked = true
            })
            if (blocked) break
          }
          return !blocked
        },
      }),
    ]
  },
})

function touchesLocked(doc: PMNode, from: number, to: number, locked: Set<string>): boolean {
  let hit = false
  const size = doc.content.size
  const start = Math.max(0, Math.min(from, size))
  const end = Math.max(start, Math.min(to, size))
  doc.nodesBetween(start, end, (node) => {
    if (hit) return false
    if (isTextBlock(node.type.name) && locked.has(node.attrs.id as string)) {
      hit = true
      return false
    }
    return true
  })
  // Insertions at a paragraph boundary have from === to; check the
  // paragraph that contains the point as well.
  if (!hit && start === end) {
    const $pos = doc.resolve(start)
    for (let depth = $pos.depth; depth > 0; depth--) {
      const node = $pos.node(depth)
      if (isTextBlock(node.type.name) && locked.has(node.attrs.id as string)) {
        hit = true
        break
      }
    }
  }
  return hit
}
