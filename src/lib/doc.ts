import type { JSONContent } from '@tiptap/core'
import type { Source } from './model'
import { inTextCitation } from './apa'
import { firstLine } from './text'

/**
 * Plain-text view of the essay used by the agent, checkers and export.
 * Citation nodes are rendered as APA in-text citations so models see what
 * the reader will see.
 */

export type ParagraphView = {
  id: string
  sectionId: string | null
  text: string
  /** Source ids cited in this paragraph, in order. */
  citations: string[]
}

export function nodeText(node: JSONContent, sources: Source[]): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'citation') {
    const source = sources.find((s) => s.id === node.attrs?.sourceId)
    return source ? inTextCitation(source) : ''
  }
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map((child) => nodeText(child, sources)).join('')
}

function collectCitations(node: JSONContent, out: string[]) {
  if (node.type === 'citation' && node.attrs?.sourceId) out.push(String(node.attrs.sourceId))
  node.content?.forEach((child) => collectCitations(child, out))
}

/** Every paragraph in document order, including those nested in lists and quotes. */
export function paragraphsOf(doc: JSONContent, sources: Source[]): ParagraphView[] {
  const out: ParagraphView[] = []
  const walk = (node: JSONContent) => {
    if (node.type === 'paragraph') {
      const citations: string[] = []
      collectCitations(node, citations)
      out.push({
        id: String(node.attrs?.id ?? ''),
        sectionId: (node.attrs?.sectionId as string | null | undefined) ?? null,
        text: nodeText(node, sources),
        citations,
      })
      return
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return out
}

export function docText(doc: JSONContent, sources: Source[]): string {
  return paragraphsOf(doc, sources)
    .map((p) => p.text)
    .join('\n\n')
}

export function citedSourceIds(doc: JSONContent): string[] {
  const ids: string[] = []
  collectCitations(doc, ids)
  return Array.from(new Set(ids))
}

export type OutlineEntry = {
  sectionId: string | null
  paragraphs: { id: string; firstLine: string; words: number }[]
}

/** Outline the agent sees by default: section, paragraph id, first line. */
export function outlineOf(paragraphs: ParagraphView[]): OutlineEntry[] {
  const map = new Map<string | null, OutlineEntry>()
  for (const p of paragraphs) {
    if (!p.text.trim()) continue
    let entry = map.get(p.sectionId)
    if (!entry) {
      entry = { sectionId: p.sectionId, paragraphs: [] }
      map.set(p.sectionId, entry)
    }
    entry.paragraphs.push({
      id: p.id,
      firstLine: firstLine(p.text),
      words: p.text.trim().split(/\s+/).length,
    })
  }
  return Array.from(map.values())
}

/** Order in which sections first appear in the essay. */
export function sectionOrderInDoc(paragraphs: ParagraphView[]): string[] {
  const seen: string[] = []
  for (const p of paragraphs) {
    if (p.sectionId && p.text.trim() && !seen.includes(p.sectionId)) seen.push(p.sectionId)
  }
  return seen
}

/**
 * Builds paragraph content from plain text, turning recognised APA in-text
 * citations back into citation nodes so accepted suggestions keep their
 * links to sources.
 */
export function contentFromText(text: string, sources: Source[]): JSONContent[] {
  const lookup = new Map<string, Source>()
  for (const s of sources) lookup.set(inTextCitation(s), s)
  const pattern = /\([^()]{2,80}?,\s*(?:\d{4}[a-z]?|n\.d\.)\)/g
  const out: JSONContent[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    const source = lookup.get(match[0])
    if (!source) continue
    if (start > last) out.push({ type: 'text', text: text.slice(last, start) })
    out.push({ type: 'citation', attrs: { sourceId: source.id, label: inTextCitation(source) } })
    last = start + match[0].length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out.filter((n) => n.type !== 'text' || (n.text ?? '').length > 0)
}
