import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { tokenize } from '@/lib/spell'

export type SpellIssue = {
  from: number
  to: number
  word: string
  suggestions: string[]
}

type SpellState = { issues: SpellIssue[]; set: DecorationSet }

export const spellKey = new PluginKey<SpellState>('spellcheck')
export const SPELL_META = 'spellIssues'

export const Spellcheck = Extension.create({
  name: 'spellcheck',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: spellKey,
        state: {
          init: (): SpellState => ({ issues: [], set: DecorationSet.empty }),
          apply: (tr, value) => {
            const incoming = tr.getMeta(SPELL_META) as SpellIssue[] | undefined
            if (incoming) return { issues: incoming, set: decorate(tr.doc, incoming) }
            if (tr.docChanged) {
              const issues = value.issues.map((issue) => ({
                ...issue,
                from: tr.mapping.map(issue.from),
                to: tr.mapping.map(issue.to),
              }))
              return { issues, set: value.set.map(tr.mapping, tr.doc) }
            }
            return value
          },
        },
        props: {
          decorations(state) {
            return spellKey.getState(state)?.set ?? DecorationSet.empty
          },
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement | null
              if (!target?.closest('.sp-error')) return false
              const span = target.closest('.sp-error')
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
              const issues = spellKey.getState(view.state)?.issues ?? []
              const word = span?.textContent ?? ''
              const pos = coords?.pos
              const hit =
                (pos !== undefined ? issues.find((item) => pos >= item.from && pos <= item.to) : undefined) ??
                issues.find((item) => item.word === word)
              view.dom.dispatchEvent(new CustomEvent('spell-open', { detail: hit ?? null }))
              return false
            },
          },
        },
      }),
    ]
  },
})

function decorate(doc: PMNode, issues: SpellIssue[]): DecorationSet {
  return DecorationSet.create(
    doc,
    issues
      .filter((issue) => issue.to > issue.from)
      .map((issue) =>
        Decoration.inline(issue.from, issue.to, { class: 'sp-error' }, { inclusiveEnd: false }),
      ),
  )
}

export function wordsInDoc(doc: PMNode): { word: string; from: number; to: number }[] {
  const hits: { word: string; from: number; to: number }[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'citation') return false
    if (!node.isText || !node.text) return
    for (const token of tokenize(node.text)) {
      const from = pos + token.offset
      const to = from + token.word.length
      hits.push({ word: token.word, from, to })
    }
  })
  return hits
}
