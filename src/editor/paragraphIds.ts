import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { newId } from '@/lib/ids'

/**
 * Every paragraph carries a stable `id` and a `sectionId` (the plan node it
 * belongs to). The agent, checkers, outline and export all address
 * paragraphs by id, never by position.
 *
 * Splitting a paragraph copies its attrs, so the appendTransaction below
 * gives the duplicate a fresh id while it keeps the same section. A
 * paragraph with no section inherits the one above it.
 */

export type ParagraphIdsOptions = {
  /** Section to use for the very first paragraph when nothing is set. */
  defaultSectionId: () => string | null
}

export const paragraphIdsKey = new PluginKey('paragraphIds')

export const ParagraphIds = Extension.create<ParagraphIdsOptions>({
  name: 'paragraphIds',

  addOptions() {
    return { defaultSectionId: () => null }
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-pid'),
            renderHTML: (attributes) => (attributes.id ? { 'data-pid': attributes.id } : {}),
          },
          sectionId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-section'),
            renderHTML: (attributes) => (attributes.sectionId ? { 'data-section': attributes.sectionId } : {}),
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: paragraphIdsKey,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null
          return assignIds(newState.tr, newState.doc, options.defaultSectionId())
        },
      }),
    ]
  },
})

function assignIds(tr: Transaction, doc: PMNode, fallbackSection: string | null): Transaction | null {
  const seen = new Set<string>()
  let previousSection: string | null = null
  let changed = false

  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return
    let id = node.attrs.id as string | null
    let sectionId = node.attrs.sectionId as string | null
    const attrs: Record<string, unknown> = {}

    if (!id || seen.has(id)) {
      id = newId('p')
      attrs.id = id
    }
    seen.add(id)

    if (!sectionId) {
      sectionId = previousSection ?? fallbackSection
      if (sectionId) attrs.sectionId = sectionId
    }
    previousSection = sectionId

    if (Object.keys(attrs).length) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs })
      changed = true
    }
  })

  return changed ? tr.setMeta('addToHistory', false) : null
}

/** Finds the position and node of the paragraph containing `pos`. */
export function paragraphAt(doc: PMNode, pos: number): { node: PMNode; pos: number } | null {
  const $pos = doc.resolve(Math.min(pos, doc.content.size))
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth)
    if (node.type.name === 'paragraph') return { node, pos: depth === 0 ? 0 : $pos.before(depth) }
  }
  return null
}

/** Finds a paragraph by id. */
export function findParagraph(doc: PMNode, id: string): { node: PMNode; pos: number } | null {
  let found: { node: PMNode; pos: number } | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === 'paragraph' && node.attrs.id === id) {
      found = { node, pos }
      return false
    }
    return true
  })
  return found
}
