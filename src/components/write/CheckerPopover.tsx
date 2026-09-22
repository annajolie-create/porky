'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'
import { Path } from '@phosphor-icons/react/dist/csr/Path'
import { Quotes } from '@phosphor-icons/react/dist/csr/Quotes'
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { useProject } from '@/lib/store'
import { findParagraph } from '@/editor/paragraphIds'
import { reassignParagraph } from '@/editor/commands'
import { cx } from '../ui'
import type { CitationVerdict } from '@/lib/model'

const CARD_W = 316

export function CheckerPopover({ editor }: { editor: Editor; container: RefObject<HTMLElement | null> }) {
  const flags = useProject((s) => s.checkerFlags)
  const checkersEnabled = useProject((s) => s.checkersEnabled)
  const activeParagraphId = useProject((s) => s.activeParagraphId)
  const plan = useProject((s) => s.plan)
  const requestAgent = useProject((s) => s.requestAgent)
  const dismissCheckerFlag = useProject((s) => s.dismissCheckerFlag)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const hoverLock = useRef(false)
  const [tick, setTick] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const dom = editor.view.dom
    let leaveTimer = 0
    const enter = (event: Event) => {
      const p = (event.target as HTMLElement).closest('p[data-pid]')
      const id = p?.getAttribute('data-pid')
      if (!id) return
      window.clearTimeout(leaveTimer)
      setHoverId(id)
    }
    const leave = (event: Event) => {
      const next = (event as MouseEvent).relatedTarget as HTMLElement | null
      if (next?.closest('[data-checker-pop]') || hoverLock.current) return
      window.clearTimeout(leaveTimer)
      leaveTimer = window.setTimeout(() => {
        if (!hoverLock.current) setHoverId(null)
      }, 160)
    }
    const onScroll = () => setTick((n) => n + 1)
    dom.addEventListener('mouseover', enter)
    dom.addEventListener('mouseout', leave)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.clearTimeout(leaveTimer)
      dom.removeEventListener('mouseover', enter)
      dom.removeEventListener('mouseout', leave)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [editor])

  if (!mounted || !checkersEnabled) return null
  const paragraphId = hoverId ?? activeParagraphId
  const flag = paragraphId ? flags[paragraphId] : null
  if (!flag || flag.dismissed) return null
  if (!flag.rambling && !flag.planFit && !flag.citationFit) return null

  const found = findParagraph(editor.state.doc, flag.paragraphId)
  if (!found) return null

  const node = editor.view.nodeDOM(found.pos)
  const el = node instanceof HTMLElement ? node : (node as Node | null)?.parentElement
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.bottom < 48 || rect.top > window.innerHeight - 24) return null

  const suggested = flag.suggestedSectionId ? plan.find((n) => n.id === flag.suggestedSectionId) : null
  void tick

  const roomRight = window.innerWidth - rect.right - 16
  const side = roomRight >= CARD_W + 8
  let left = side ? rect.right + 12 : Math.min(Math.max(12, rect.left), window.innerWidth - CARD_W - 12)
  left = Math.min(Math.max(12, left), window.innerWidth - CARD_W - 12)
  const estimatedHeight = 72 + (flag.rambling ? 96 : 0) + (flag.planFit ? 110 : 0) + (flag.citationFit ? 88 : 0)
  let top = side ? Math.max(12, rect.top) : rect.bottom + 10
  if (top + estimatedHeight > window.innerHeight - 12) {
    top = Math.max(12, window.innerHeight - estimatedHeight - 12)
  }
  if (!side && rect.top > estimatedHeight + 24 && rect.bottom + 10 + estimatedHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - estimatedHeight - 10)
  }

  return createPortal(
    <div
      data-checker-pop
      role="dialog"
      aria-label="Writing check"
      className="no-print fixed z-[90] w-[316px] menu-in"
      style={{ top, left, ['--menu-origin' as string]: side ? '0 12px' : '24px 0' }}
      onMouseEnter={() => {
        hoverLock.current = true
        setHoverId(flag.paragraphId)
      }}
      onMouseLeave={() => {
        hoverLock.current = false
        setHoverId(null)
      }}
    >
      <div className="relative rounded-2xl border border-line bg-surface overflow-hidden shadow-[0_1px_2px_rgba(26,25,22,0.06),0_20px_44px_-14px_rgba(26,25,22,0.34)]">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gold" />
        <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
          <span className="size-6 rounded-md bg-gold-soft text-gold-ink grid place-items-center">
            <Sparkle size={12} weight="fill" />
          </span>
          <p className="flex-1 text-[12.5px] font-semibold tracking-[-0.01em]">While you write</p>
          <button
            type="button"
            onClick={() => dismissCheckerFlag(flag.paragraphId)}
            className="p-1 rounded-md text-muted hover:text-ink hover:bg-black/5 active:scale-[0.97]"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>

        <div className="px-2.5 pb-2.5 space-y-1.5">
          {flag.rambling ? (
            <Issue
              icon={Warning}
              tone="warn"
              title="Rambling"
              body={flag.rambling.reason || 'This paragraph feels padded or off-point.'}
              action="Tighten it"
              onFix={() =>
                requestAgent({
                  paragraphId: flag.paragraphId,
                  prompt: `This paragraph is rambling: ${flag.rambling?.reason}. Rewrite it so every sentence earns its place. Propose an edit to ${flag.paragraphId}.`,
                })
              }
            />
          ) : null}
          {flag.planFit ? (
            <Issue
              icon={Path}
              tone="accent"
              title="Doesn’t fit this section"
              body={flag.planFit.reason || 'This paragraph does not match the section claim.'}
              action="Rewrite to fit"
              onFix={() =>
                requestAgent({
                  paragraphId: flag.paragraphId,
                  prompt: `This paragraph does not fit its plan section: ${flag.planFit?.reason}. Rewrite it so it serves the section, or say it should move. Propose an edit to ${flag.paragraphId}.`,
                })
              }
              extra={
                suggested ? (
                  <button
                    type="button"
                    className="text-[12.5px] font-medium text-gold-ink hover:underline"
                    onClick={() => reassignParagraph(editor, flag.paragraphId, suggested.id)}
                  >
                    Move to “{suggested.title}”
                  </button>
                ) : null
              }
            />
          ) : null}
          {flag.citationFit ? (
            <Issue
              icon={Quotes}
              tone={flag.citationFit.verdict === 'fits' ? 'ok' : flag.citationFit.verdict === 'weak' ? 'warn' : 'bad'}
              title={citationTitle(flag.citationFit.verdict)}
              body={flag.citationFit.reason}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function citationTitle(verdict: CitationVerdict) {
  if (verdict === 'fits') return 'Citation fits'
  if (verdict === 'weak') return 'Citation is weak'
  return 'Citation doesn’t fit'
}

function Issue({
  icon: Icon,
  tone,
  title,
  body,
  action,
  onFix,
  extra,
}: {
  icon: typeof Warning
  tone: 'warn' | 'accent' | 'ok' | 'bad'
  title: string
  body: string
  action?: string
  onFix?: () => void
  extra?: ReactNode
}) {
  const tones = {
    warn: { wrap: 'bg-warn-bg/70', icon: 'text-warn', bar: 'bg-warn' },
    accent: { wrap: 'bg-accent-soft/55', icon: 'text-gold-ink', bar: 'bg-gold' },
    ok: { wrap: 'bg-ins-bg/70', icon: 'text-ins', bar: 'bg-ins' },
    bad: { wrap: 'bg-del-bg/70', icon: 'text-del', bar: 'bg-del' },
  }[tone]

  return (
    <div className={cx('relative rounded-xl px-3 py-2.5', tones.wrap)}>
      <span className={cx('absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full', tones.bar)} />
      <div className="flex items-start gap-2 pl-1.5">
        <Icon size={15} className={cx('mt-0.5 shrink-0', tones.icon)} />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold tracking-[-0.02em] leading-snug">{title}</p>
          <p className="mt-1 text-[13px] leading-[1.45] text-ink-soft">{body}</p>
          {onFix || extra ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {onFix && action ? (
                <button
                  type="button"
                  onClick={onFix}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-surface/80 text-[12.5px] font-medium text-ink hover:bg-surface active:scale-[0.98]"
                >
                  <Sparkle size={12} weight="fill" className="text-gold-ink" />
                  {action}
                  <ArrowRight size={11} />
                </button>
              ) : null}
              {extra}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
