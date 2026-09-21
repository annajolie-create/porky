import { tokens } from './text'

export type Passage = { index: number; text: string; score: number }

/**
 * Splits a source into ~600-character passages and ranks them by lexical
 * overlap with a query. Good enough to pick the handful of passages a
 * judgment needs, which keeps Jev calls well under its 32K-token limit.
 */
export function splitPassages(text: string, size = 600): string[] {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
  if (!clean) return []
  const paragraphs = clean.split(/\n{2,}|\n(?=\S)/).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  let buffer = ''
  for (const p of paragraphs) {
    if ((buffer + ' ' + p).length > size && buffer) {
      out.push(buffer.trim())
      buffer = p
    } else {
      buffer = buffer ? `${buffer} ${p}` : p
    }
    while (buffer.length > size * 1.6) {
      out.push(buffer.slice(0, size).trim())
      buffer = buffer.slice(size)
    }
  }
  if (buffer.trim()) out.push(buffer.trim())
  return out
}

export function rankPassages(text: string, query: string, limit = 4): Passage[] {
  const passages = splitPassages(text)
  const q = new Set(tokens(query))
  if (!q.size) return passages.slice(0, limit).map((p, i) => ({ index: i, text: p, score: 0 }))
  const scored = passages.map((p, index) => {
    const t = tokens(p)
    let hits = 0
    for (const tok of t) if (q.has(tok)) hits++
    const score = hits / Math.sqrt(t.length + 1)
    return { index, text: p, score }
  })
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
}

export function relevantPassages(text: string, query: string, limit = 4): string[] {
  return rankPassages(text, query, limit).map((p) => p.text)
}
