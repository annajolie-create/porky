import 'server-only'
import { createRequire } from 'node:module'

type Dictionary = { aff: Uint8Array; dic: Uint8Array }
type Checker = {
  correct: (word: string) => boolean
  suggest: (word: string) => string[]
}

const require = createRequire(import.meta.url)
const nspell = require('nspell') as (dict: { aff: string; dic: string }) => Checker

const LOADERS: Record<string, () => Promise<{ default: Dictionary }>> = {
  English: () => import('dictionary-en'),
  German: () => import('dictionary-de'),
  Spanish: () => import('dictionary-es'),
  French: () => import('dictionary-fr'),
  Italian: () => import('dictionary-it'),
  Dutch: () => import('dictionary-nl'),
  Portuguese: () => import('dictionary-pt'),
}

const cache = new Map<string, Promise<Checker>>()
const decoder = new TextDecoder('utf-8')

function asText(value: Uint8Array): string {
  return decoder.decode(value)
}

async function load(language: string): Promise<Checker> {
  const loader = LOADERS[language] ?? LOADERS.English
  const mod = await loader()
  const dict = mod.default
  return nspell({ aff: asText(dict.aff), dic: asText(dict.dic) })
}

function checkerFor(language: string): Promise<Checker> {
  const key = LOADERS[language] ? language : 'English'
  let pending = cache.get(key)
  if (!pending) {
    pending = load(key)
    cache.set(key, pending)
  }
  return pending
}

const MAX_WORDS = 80
const MAX_SUGGESTIONS = 5

/** Common student typos nspell ranks poorly (e.g. “teh” → “the”). */
const COMMON: Record<string, string> = {
  teh: 'the',
  adn: 'and',
  taht: 'that',
  recieve: 'receive',
  seperate: 'separate',
  occured: 'occurred',
  definately: 'definitely',
  neccessary: 'necessary',
  accomodate: 'accommodate',
  begining: 'beginning',
  existance: 'existence',
  independant: 'independent',
  wich: 'which',
  enviroment: 'environment',
  goverment: 'government',
  arguement: 'argument',
  untill: 'until',
}

function suggestionsFor(spell: Checker, word: string): string[] {
  const ranked = spell.suggest(word)
  const common = COMMON[word.toLowerCase()]
  if (!common) return ranked.slice(0, MAX_SUGGESTIONS)
  return [common, ...ranked.filter((item) => item !== common)].slice(0, MAX_SUGGESTIONS)
}

export type SpellResult = Record<string, string[]>

/** Returns suggestions for misspelled words; correct words are omitted. */
export async function checkWords(language: string, words: string[]): Promise<SpellResult> {
  const spell = await checkerFor(language)
  const unique: string[] = []
  const seen = new Set<string>()
  for (const word of words) {
    const trimmed = word.trim()
    if (!trimmed || trimmed.length > 64) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(trimmed)
    if (unique.length >= MAX_WORDS) break
  }

  const out: SpellResult = {}
  for (const word of unique) {
    if (spell.correct(word)) continue
    out[word.toLowerCase()] = suggestionsFor(spell, word)
  }
  return out
}
