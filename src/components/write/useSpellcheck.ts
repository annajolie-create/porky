'use client'

import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { useProject } from '@/lib/store'
import { postJSON } from '@/lib/sse'
import { collectKnownWords, isIgnored, spellKey, subscribeIgnore } from '@/lib/spell'
import { SPELL_META, wordsInDoc, type SpellIssue } from '@/editor/spellcheck'

const PAUSE_MS = 280
const MAX_BATCH = 80

type CacheEntry = { ok: true } | { ok: false; suggestions: string[] }

/**
 * Underlines misspellings and caches replacements so the popover can apply
 * a fix without another round trip.
 */
export function useSpellcheck(editor: Editor | null) {
  const language = useProject((s) => s.context.language)
  const title = useProject((s) => s.title)
  const task = useProject((s) => s.context.task)
  const plan = useProject((s) => s.plan)
  const sources = useProject((s) => s.sources)
  const cache = useRef(new Map<string, CacheEntry>())
  const timer = useRef<number | null>(null)
  const inflight = useRef(0)

  useEffect(() => {
    if (!editor) return

    const known = collectKnownWords([
      title,
      task,
      ...plan.map((n) => n.title),
      ...plan.flatMap((n) => n.keyPoints),
      ...sources.flatMap((s) => [s.title, ...s.authors]),
    ])

    const run = async () => {
      if (editor.isDestroyed) return
      const { doc } = editor.state
      const tokens = wordsInDoc(doc)
      const missing: string[] = []
      const missingSeen = new Set<string>()

      const issues: SpellIssue[] = []
      for (const token of tokens) {
        if (isIgnored(token.word) || known.has(token.word.toLowerCase())) continue
        const key = spellKey(language, token.word)
        const hit = cache.current.get(key)
        if (!hit) {
          if (!missingSeen.has(key) && missing.length < MAX_BATCH) {
            missingSeen.add(key)
            missing.push(token.word)
          }
          continue
        }
        if (!hit.ok) issues.push({ ...token, suggestions: hit.suggestions })
      }

      editor.view.dispatch(editor.state.tr.setMeta(SPELL_META, issues).setMeta('addToHistory', false))

      if (!missing.length) return
      const generation = ++inflight.current
      try {
        const { misses } = await postJSON<{ misses: Record<string, string[]> }>('/api/spell', {
          language,
          words: missing,
        })
        if (generation !== inflight.current || editor.isDestroyed) return
        for (const word of missing) {
          const key = spellKey(language, word)
          const suggestions = misses[word.toLowerCase()]
          cache.current.set(key, suggestions ? { ok: false, suggestions } : { ok: true })
        }
        run()
      } catch {
        // Spelling must never interrupt writing.
      }
    }

    const schedule = () => {
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        void run()
      }, PAUSE_MS)
    }

    void run()
    editor.on('update', schedule)
    const unsub = subscribeIgnore(schedule)
    return () => {
      editor.off('update', schedule)
      unsub()
      if (timer.current) window.clearTimeout(timer.current)
      inflight.current += 1
    }
  }, [editor, language, title, task, plan, sources])
}
