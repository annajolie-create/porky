'use client'

import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { useProject } from '@/lib/store'
import { hashText } from '@/lib/ids'
import { paragraphsOf } from '@/lib/doc'
import { sentences } from '@/lib/text'
import { relevantPassages } from '@/lib/passages'
import { paragraphAt } from '@/editor/paragraphIds'
import { postJSON } from '@/lib/sse'
import type { CheckerFlag, CitationVerdict } from '@/lib/model'

type DecideResponse = {
  planFit?: { probability: number; reason: string }
  rambling?: { probability: number; reason: string }
  suggestedSectionId?: string | null
  citationFit?: { sourceId: string; verdict: CitationVerdict; reason: string }
}

const PAUSE_MS = 2000
const MIN_WORDS = 12
const FIT_LOW = 0.4
const RAMBLE_HIGH = 0.62

/**
 * Quiet live checks on the paragraph being edited. Debounced until a sentence
 * ends or the student pauses. Results for text that has changed since the
 * request started are thrown away.
 */
export function useLiveCheckers(editor: Editor | null) {
  const checkersEnabled = useProject((s) => s.checkersEnabled)
  const plan = useProject((s) => s.plan)
  const sources = useProject((s) => s.sources)
  const suggestions = useProject((s) => s.suggestions)
  const citationCheckRequest = useProject((s) => s.citationCheckRequest)
  const timer = useRef<number | null>(null)
  const inflight = useRef<Record<string, string>>({})

  useEffect(() => {
    if (!editor) return

    const schedule = (immediate: boolean) => {
      if (!useProject.getState().checkersEnabled) return
      if (timer.current) window.clearTimeout(timer.current)
      const run = () => {
        const found = paragraphAt(editor.state.doc, editor.state.selection.from)
        if (!found) return
        void checkParagraph(editor, found.node.attrs.id as string)
      }
      if (immediate) run()
      else timer.current = window.setTimeout(run, PAUSE_MS)
    }

    const onUpdate = ({ editor: ed }: { editor: Editor }) => {
      const { from } = ed.state.selection
      const $pos = ed.state.doc.resolve(from)
      const ch = $pos.parent.textBetween(Math.max(0, $pos.parentOffset - 1), $pos.parentOffset)
      schedule(/[.!?]/.test(ch))
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [editor, checkersEnabled])

  useEffect(() => {
    if (!editor || !citationCheckRequest || !checkersEnabled) return
    const found = paragraphAt(editor.state.doc, editor.state.selection.from)
    if (found) void checkParagraph(editor, found.node.attrs.id as string, citationCheckRequest.sourceId)
    useProject.getState().clearCitationCheck()
  }, [editor, citationCheckRequest, checkersEnabled])

  async function checkParagraph(ed: Editor, paragraphId: string, citationSourceId?: string) {
    if (useProject.getState().suggestions.some((s) => s.paragraphId === paragraphId)) return
    const view = paragraphsOf(ed.getJSON(), useProject.getState().sources).find((p) => p.id === paragraphId)
    if (!view || view.text.trim().split(/\s+/).length < MIN_WORDS) {
      useProject.getState().clearCheckerFlag(paragraphId)
      return
    }
    const textHash = hashText(view.text)
    const existing = useProject.getState().checkerFlags[paragraphId]
    if (existing?.dismissed && existing.textHash === textHash && !citationSourceId) return
    inflight.current[paragraphId] = textHash

    const planNow = useProject.getState().plan
    const section = planNow.find((n) => n.id === view.sectionId) ?? null
    const sourceId = citationSourceId ?? view.citations[view.citations.length - 1]
    const source = sourceId ? useProject.getState().sources.find((s) => s.id === sourceId) : null
    const lastSentence = sentences(view.text).slice(-1)[0] ?? view.text

    try {
      const result = await postJSON<DecideResponse>('/api/decide', {
        paragraph: { id: view.id, text: view.text, sectionId: view.sectionId },
        section: section
          ? { id: section.id, title: section.title, claim: section.claim, keyPoints: section.keyPoints }
          : null,
        sections: planNow.map((n) => ({ id: n.id, title: n.title, claim: n.claim })),
        citation: source
          ? {
              sourceId: source.id,
              title: source.title,
              sentence: lastSentence,
              passages: relevantPassages(source.text, lastSentence, 4),
            }
          : undefined,
      })
      if (inflight.current[paragraphId] !== textHash) return
      const current = paragraphsOf(ed.getJSON(), useProject.getState().sources).find((p) => p.id === paragraphId)
      if (!current || hashText(current.text) !== textHash) return

      const flag: CheckerFlag = {
        paragraphId,
        textHash,
        dismissed: false,
        planFit:
          result.planFit && result.planFit.probability < FIT_LOW
            ? { probability: result.planFit.probability, reason: result.planFit.reason }
            : undefined,
        rambling:
          result.rambling && result.rambling.probability > RAMBLE_HIGH
            ? { probability: result.rambling.probability, reason: result.rambling.reason }
            : undefined,
        suggestedSectionId: result.suggestedSectionId,
        citationFit: result.citationFit,
      }
      if (flag.planFit || flag.rambling || flag.citationFit) useProject.getState().setCheckerFlag(flag)
      else useProject.getState().clearCheckerFlag(paragraphId)
    } catch {
      // Live checks must never interrupt writing.
    }
  }

  void plan
  void sources
  void suggestions
}
