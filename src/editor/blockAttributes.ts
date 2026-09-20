import { Extension } from '@tiptap/core'
import type { CommandProps } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

/**
 * Indent and line spacing are properties of a block, not of a span of text.
 * TextStyleKit ships a `lineHeight` mark, but a mark splits when a paragraph
 * splits, so spacing set on one paragraph would not survive pressing Enter.
 * Both live here instead, as global attributes on paragraphs and headings.
 */

const TYPES = ['paragraph', 'heading']

export const INDENT_STEP = 40
export const MAX_INDENT = 8

export const LINE_HEIGHTS = ['1', '1.15', '1.5', '2', '2.5', '3'] as const
export type LineHeightValue = (typeof LINE_HEIGHTS)[number]
export const DEFAULT_LINE_HEIGHT: LineHeightValue = '1.5'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockAttributes: {
      indent: () => ReturnType
      outdent: () => ReturnType
      /** Named apart from TextStyleKit's mark-based setLineHeight. */
      setBlockLineHeight: (value: string) => ReturnType
      unsetBlockLineHeight: () => ReturnType
    }
  }
}

function shiftIndent(direction: 1 | -1) {
  return ({ state, tr, dispatch }: CommandProps) => {
    const { from, to } = state.selection
    let changed = false

    state.doc.nodesBetween(from, to, (node: ProseMirrorNode, pos: number) => {
      if (!TYPES.includes(node.type.name)) return
      const current = Number(node.attrs.indent) || 0
      const next = Math.max(0, Math.min(MAX_INDENT, current + direction))
      if (next === current) return
      tr.setNodeAttribute(pos, 'indent', next)
      changed = true
    })

    if (changed && dispatch) dispatch(tr)
    return changed
  }
}

export const BlockAttributes = Extension.create({
  name: 'blockAttributes',

  // Above ListItem and CodeBlock, both of which bind Tab. We want to decide
  // which of the three meanings of Tab applies rather than depend on load order.
  priority: 1000,

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const margin = parseFloat(element.style.marginLeft || '0')
              if (!margin) return 0
              return Math.max(0, Math.min(MAX_INDENT, Math.round(margin / INDENT_STEP)))
            },
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent) || 0
              if (!indent) return {}
              return { style: `margin-left: ${indent * INDENT_STEP}px` }
            },
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {}
              return { style: `line-height: ${attributes.lineHeight}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      indent: () => shiftIndent(1),
      outdent: () => shiftIndent(-1),

      // map before every, so a selection inside a heading still gets updated
      // when the paragraph branch reports false. Short-circuiting here would
      // silently skip every type after the first miss.
      setBlockLineHeight:
        (value: string) =>
        ({ commands }) =>
          TYPES.map((type) => commands.updateAttributes(type, { lineHeight: value })).some(Boolean),

      unsetBlockLineHeight:
        () =>
        ({ commands }) =>
          TYPES.map((type) => commands.resetAttributes(type, 'lineHeight')).some(Boolean),
    }
  },

  addKeyboardShortcuts() {
    return {
      // Tab means three different things. Inside a code block it is literal
      // indentation, so hand it back to CodeBlock. Inside a list it nests the
      // item. Everywhere else it indents the block — and is always swallowed,
      // so Tab never walks focus out of the document mid-sentence.
      Tab: () => {
        if (this.editor.isActive('codeBlock')) return false
        this.editor.commands.first(({ commands }) => [
          () => commands.sinkListItem('listItem'),
          () => commands.indent(),
        ])
        return true
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('codeBlock')) return false
        this.editor.commands.first(({ commands }) => [
          () => commands.liftListItem('listItem'),
          () => commands.outdent(),
        ])
        return true
      },
      'Mod-]': () => this.editor.commands.indent(),
      'Mod-[': () => this.editor.commands.outdent(),
      'Mod-\\': () => this.editor.chain().focus().unsetAllMarks().clearNodes().run(),
    }
  },
})
