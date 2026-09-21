/** Tokenise prose for spelling, and keep a small ignore list in this browser. */

const WORD = /\p{L}+(?:['’]\p{L}+)*/gu
const IGNORE_KEY = 'porky.spell-ignore'

export type SpellToken = { word: string; offset: number }

export function tokenize(text: string): SpellToken[] {
  const out: SpellToken[] = []
  for (const match of text.matchAll(WORD)) {
    const word = match[0]
    if (word.length < 2) continue
    if (isAcronym(word)) continue
    out.push({ word, offset: match.index ?? 0 })
  }
  return out
}

/** APA, NASA, GDP — not misspellings. */
function isAcronym(word: string): boolean {
  return word.length <= 5 && word === word.toUpperCase()
}

export function spellKey(language: string, word: string): string {
  return `${language}:${word.toLowerCase()}`
}

/** Keep the replacement’s casing in step with what the student typed. */
export function matchCase(original: string, suggestion: string): string {
  if (!original || !suggestion) return suggestion
  if (original === original.toUpperCase()) return suggestion.toUpperCase()
  if (original[0] === original[0].toUpperCase()) {
    return suggestion[0].toUpperCase() + suggestion.slice(1)
  }
  return suggestion
}

let ignored = readIgnored()
const ignoreListeners = new Set<() => void>()

function readIgnored(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(IGNORE_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(list) ? list.map((w) => String(w).toLowerCase()) : [])
  } catch {
    return new Set()
  }
}

export function isIgnored(word: string): boolean {
  return ignored.has(word.toLowerCase())
}

export function ignoreWord(word: string): void {
  ignored.add(word.toLowerCase())
  try {
    window.localStorage.setItem(IGNORE_KEY, JSON.stringify([...ignored]))
  } catch {
    // Storage full or blocked; the in-memory set still works this session.
  }
  ignoreListeners.forEach((fn) => fn())
}

export function subscribeIgnore(listener: () => void): () => void {
  ignoreListeners.add(listener)
  return () => {
    ignoreListeners.delete(listener)
  }
}

export function collectKnownWords(texts: (string | undefined | null)[]): Set<string> {
  const known = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const token of tokenize(text)) known.add(token.word.toLowerCase())
  }
  return known
}
