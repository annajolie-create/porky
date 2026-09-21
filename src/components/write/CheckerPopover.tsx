'use client'

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { useProject } from '@/lib/store'
import { findParagraph } from '@/editor/paragraphIds'
import { reassignParagraph } from '@/editor/commands'
import { Pill } from '../ui'
import type { CitationVerdict } from '@/lib/model'

export function CheckerPopover({ editor }: { editor: Editor; container: RefObject<HTMLElement | null> }) {
  const flags = useProject((s) => s.checkerFlags)
  const checkersEnabled = useProject((s) => s.checkersEnabled)
  const activeParagraphId = useProject((s) => s.activeParagraphId)
  const plan = useProject((s) => s.plan)
  const requestAgent = useProject((s) => s.requestAgent)
  const dismissCheckerFlag = useProject((s) => s.dismissCheckerFlag)
  const [hoverId, setHoverId] = useState<string | null>(null)

  useEffect(() => {
    const dom = editor.view.dom
    const enter = (event: Event) => {
      const p = (event.target as HTMLElement).closest('p[data-pid]')
      setHoverId(p?.getAttribute('data-pid') ?? null)
    }
    const leave = (event: Event) => {
      const next = (event as MouseEvent).relatedTarget as HTMLElement | null
      if (next?.closest('[data-checker-pop]')) return
      setHoverId(null)
    }
    dom.addEventListener('mouseover', enter)
    dom.addEventListener('mouseout', leave)
    return () => {
      dom.removeEventListener('mouseover', enter)
      dom.removeEventListener('mouseout', leave)
    }
  }, [editor])

  if (!checkersEnabled) return null
  const paragraphId = hoverId ?? activeParagraphId
  const flag = paragraphId ? flags[paragraphId] : null
  if (!flag || flag.dismissed) return null
  if (!flag.rambling && !flag.planFit && !flag.citationFit) return null

  const found = findParagraph(editor.state.doc, flag.paragraphId)
  if (!found) return null
  const coords = editor.view.coordsAtPos(found.pos + found.node.nodeSize - 1)

  const suggested = flag.suggestedSectionId ? plan.find((n) => n.id === flag.suggestedSectionId) : null

  return (
    <div
      data-checker-pop
      className="no-print fixed z-20 w-[280px] rounded-md border border-line bg-surface shadow-soft p-3 fade-in"
      style={{ top: coords.bottom + 8, left: Math.min(coords.left, window.innerWidth - 300) }}
    >
      {flag.rambling ? (
        <Row
          title="Rambling"
          body={flag.rambling.reason || 'This paragraph feels padded or off-point.'}
          onFix={() =>
            requestAgent({
              paragraphId: flag.paragraphId,
              prompt: `This paragraph is rambling: ${flag.rambling?.reason}. Rewrite it so every sentence earns its place. Propose an edit to ${flag.paragraphId}.`,
            })
          }
        />
      ) : null}
      {flag.planFit ? (
        <Row
          title="Doesn’t fit this section"
          body={flag.planFit.reason || 'This paragraph does not match the section claim.'}
          onFix={() =>
            requestAgent({
              paragraphId: flag.paragraphId,
              prompt: `This paragraph does not fit its plan section: ${flag.planFit?.reason}. Rewrite it so it serves the section, or say it should move. Propose an edit to ${flag.paragraphId}.`,
            })
          }
        />
      ) : null}
      {suggested && flag.planFit ? (
        <button
          type="button"
          className="mt-1 text-[12.5px] text-accent hover:underline"
          onClick={() => reassignParagraph(editor, flag.paragraphId, suggested.id)}
        >
          Move to “{suggested.title}”
        </button>
      ) : null}
      {flag.citationFit ? <CitationRow verdict={flag.citationFit.verdict} reason={flag.citationFit.reason} /> : null}
      <button
        type="button"
        onClick={() => dismissCheckerFlag(flag.paragraphId)}
        className="absolute top-1.5 right-1.5 p-1 text-muted hover:text-ink"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  )
}

function Row({ title, body, onFix }: { title: string; body: string; onFix: () => void }) {
  return (
    <div className="pr-4 mb-2 last:mb-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{title}</p>
      <p className="text-[12.5px] leading-relaxed text-ink mt-0.5">{body}</p>
      <button type="button" onClick={onFix} className="mt-1 inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
        <Sparkle size={12} weight="fill" />
        Fix with AI
      </button>
    </div>
  )
}

function CitationRow({ verdict, reason }: { verdict: CitationVerdict; reason: string }) {
  const tone = verdict === 'fits' ? 'ok' : verdict === 'weak' ? 'warn' : 'bad'
  const label = verdict === 'fits' ? 'Fits' : verdict === 'weak' ? 'Weak' : 'Doesn’t fit'
  return (
    <div className="pr-4 mt-2 pt-2 border-t border-line">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Citation</span>
        <Pill tone={tone}>{label}</Pill>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink mt-0.5">{reason}</p>
    </div>
  )
}
