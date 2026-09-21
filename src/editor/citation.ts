import { Node, mergeAttributes } from '@tiptap/core'

/**
 * Inline APA citation, e.g. (Smith, 2021). Inserted from the sources window
 * with no AI involved. `label` is stored on the node so rendering needs no
 * lookup; it is refreshed when the student edits a source's author or year.
 */

export type CitationAttrs = { sourceId: string; label: string }

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (attrs: CitationAttrs) => ReturnType
      relabelCitations: (labels: Record<string, string>) => ReturnType
    }
  }
}

export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      sourceId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-source-id'),
        renderHTML: (attributes) => ({ 'data-source-id': attributes.sourceId }),
      },
      label: {
        default: '',
        parseHTML: (element) => element.textContent,
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-source-id]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'citation', contenteditable: 'false' }), node.attrs.label as string]
  },

  renderText({ node }) {
    return node.attrs.label as string
  },

  addCommands() {
    return {
      insertCitation:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent([{ type: this.name, attrs }, { type: 'text', text: ' ' }])
            .run(),

      relabelCitations:
        (labels) =>
        ({ tr, state, dispatch }) => {
          let changed = false
          state.doc.descendants((node, pos) => {
            if (node.type.name !== this.name) return
            const next = labels[node.attrs.sourceId as string]
            if (next && next !== node.attrs.label) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, label: next })
              changed = true
            }
          })
          if (changed && dispatch) {
            tr.setMeta('addToHistory', false)
            dispatch(tr)
          }
          return changed
        },
    }
  },
})
