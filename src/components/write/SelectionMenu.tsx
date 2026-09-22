'use client'

import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { ChatTeardropText } from '@phosphor-icons/react/dist/csr/ChatTeardropText'
import { MagicWand } from '@phosphor-icons/react/dist/csr/MagicWand'
import { ArrowsInLineHorizontal } from '@phosphor-icons/react/dist/csr/ArrowsInLineHorizontal'
import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut'
import { Books } from '@phosphor-icons/react/dist/csr/Books'
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft'
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp'
import { useProject } from '@/lib/store'
import { newId } from '@/lib/ids'
import { paragraphAt } from '@/editor/paragraphIds'
import { selectedText } from '@/editor/commands'
import { Button, cx } from '../ui'

const ACTIONS: {
  id: string
  label: string
  hint: string
  icon: typeof MagicWand
  prompt: (text: string) => string
}[] = [
  {
    id: 'improve',
    label: 'Improve',
    hint: 'Clearer, same voice',
    icon: MagicWand,
    prompt: (t) => `Improve this selected text. Keep the meaning and voice. Propose an edit to the paragraph.\n\n"""${t}"""`,
  },
  {
    id: 'shorten',
    label: 'Shorten',
    hint: 'Keep the claim',
    icon: ArrowsInLineHorizontal,
    prompt: (t) => `Shorten this selected text without losing the claim. Propose an edit.\n\n"""${t}"""`,
  },
  {
    id: 'expand',
    label: 'Expand',
    hint: 'One more point',
    icon: ArrowsOut,
    prompt: (t) => `Expand this selected text with one more supporting point from the sources. Propose an edit.\n\n"""${t}"""`,
  },
  {
    id: 'source',
    label: 'Find source',
    hint: 'Add an APA citation',
    icon: Books,
    prompt: (t) => `Find the best source for this claim and propose an edit that adds an APA citation.\n\n"""${t}"""`,
  },
]

export function SelectionMenu({ editor }: { editor: Editor; container: RefObject<HTMLElement | null> }) {
  const requestAgent = useProject((s) => s.requestAgent)
  const addComment = useProject((s) => s.addComment)
  const setActiveComment = useProject((s) => s.setActiveComment)
  const [coords, setCoords] = useState<{ top: number; bottom: number; left: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [draft, setDraft] = useState('')
  const [text, setText] = useState('')
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const update = () => {
      const { from, to } = editor.state.selection
      if (from === to) {
        setCoords(null)
        setOpen(false)
        setCustom(false)
        setDraft('')
        setText('')
        return
      }
      const sel = selectedText(editor)
      if (!sel.trim()) {
        setCoords(null)
        return
      }
      const start = editor.view.coordsAtPos(from)
      const end = editor.view.coordsAtPos(to)
      setCoords({
        top: Math.min(start.top, end.top),
        bottom: Math.max(start.bottom, end.bottom),
        left: (start.left + end.left) / 2,
      })
      setText(sel)
    }
    editor.on('selectionUpdate', update)
    editor.on('blur', () => {
      window.setTimeout(() => {
        if (editor.state.selection.empty) {
          setCoords(null)
          setOpen(false)
          setCustom(false)
        }
      }, 150)
    })
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      editor.off('selectionUpdate', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [editor])

  useEffect(() => {
    if (!custom) return
    inputRef.current?.focus()
  }, [custom])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (custom) {
        setCustom(false)
        setDraft('')
        return
      }
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, custom])

  if (!mounted || !coords) return null

  const ask = (prompt: string) => {
    const found = paragraphAt(editor.state.doc, editor.state.selection.from)
    requestAgent({ prompt, paragraphId: (found?.node.attrs.id as string) ?? undefined, selection: text })
    setOpen(false)
    setCustom(false)
    setDraft('')
    editor.commands.focus()
  }

  const sendCustom = () => {
    const instruction = draft.trim()
    if (!instruction) return
    ask(`${instruction}\n\n"""${text}"""`)
  }

  const comment = () => {
    const found = paragraphAt(editor.state.doc, editor.state.selection.from)
    const paragraphId = (found?.node.attrs.id as string) ?? ''
    const body = window.prompt('Comment')
    if (!body?.trim() || !paragraphId) return
    const id = newId('c')
    addComment({
      id,
      paragraphId,
      quote: text.slice(0, 180),
      author: 'student',
      text: body.trim(),
      replies: [],
      resolved: false,
      createdAt: Date.now(),
    })
    setActiveComment(id)
    setOpen(false)
  }

  const panelWidth = custom ? 340 : 248
  const width = open ? panelWidth : 148
  const left = Math.min(Math.max(12, coords.left - width / 2), window.innerWidth - width - 12)
  const pillLeft = Math.min(Math.max(12, coords.left - 74), window.innerWidth - 160)
  const spaceAbove = coords.top - 56
  const spaceBelow = window.innerHeight - coords.bottom - 24
  const placeAbove = spaceAbove > spaceBelow && spaceAbove > 220
  const pillStyle = { left: pillLeft, bottom: window.innerHeight - coords.top + 8 }
  const panelStyle = placeAbove
    ? { left, bottom: window.innerHeight - coords.top + 46 }
    : { left, top: coords.bottom + 8 }

  const panel = open ? (
    <div
      className={cx(
        'menu-in fixed z-[90] rounded-2xl border border-line bg-surface overflow-hidden',
        'shadow-[0_1px_2px_rgba(26,25,22,0.06),0_18px_40px_-12px_rgba(26,25,22,0.32)]',
      )}
      style={{ ...panelStyle, width: panelWidth, ['--menu-origin' as string]: placeAbove ? '50% 100%' : '50% 0' }}
    >
      {custom ? (
        <form
          className="p-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            sendCustom()
          }}
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setCustom(false)
              setDraft('')
            }}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted hover:text-ink mb-2.5 active:scale-[0.98]"
          >
            <ArrowLeft size={12} />
            Actions
          </button>
          <p className="text-[13.5px] font-semibold tracking-[-0.02em]">Custom prompt</p>
          <p className="mt-2 text-[12.5px] leading-snug text-ink-soft line-clamp-2 border-l-2 border-gold pl-2.5">
            “{text}”
          </p>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendCustom()
              }
            }}
            rows={3}
            placeholder="What should the agent do with this?"
            aria-label="Custom prompt"
            className="mt-3 w-full min-h-[84px] resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-[13.5px] leading-relaxed placeholder:text-muted/80 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setCustom(false)
                setDraft('')
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={!draft.trim()} onMouseDown={(e) => e.preventDefault()}>
              <ArrowUp size={13} weight="bold" />
              Send
            </Button>
          </div>
        </form>
      ) : (
        <div className="p-1.5">
          <p className="px-2 pt-1.5 pb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Ask AI</p>
          {ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => ask(action.prompt(text))}
                className="w-full flex items-start gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-paper active:scale-[0.99]"
              >
                <span className="mt-0.5 size-7 shrink-0 rounded-lg bg-gold-soft text-gold-ink grid place-items-center">
                  <Icon size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold tracking-[-0.01em]">{action.label}</span>
                  <span className="block text-[12px] text-muted mt-0.5">{action.hint}</span>
                </span>
              </button>
            )
          })}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setCustom(true)}
            className="w-full flex items-start gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-paper active:scale-[0.99]"
          >
            <span className="mt-0.5 size-7 shrink-0 rounded-lg bg-paper border border-line text-ink-soft grid place-items-center">
              <PencilSimple size={14} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold tracking-[-0.01em]">Custom prompt</span>
              <span className="block text-[12px] text-muted mt-0.5">Write your own instruction</span>
            </span>
          </button>
        </div>
      )}
    </div>
  ) : null

  const pill = (
    <div
      className="no-print fixed z-[90] inline-flex items-center rounded-full bg-ink text-white shadow-[0_8px_24px_-10px_rgba(26,25,22,0.55)] overflow-hidden"
      style={pillStyle}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setOpen((v) => !v)
          setCustom(false)
        }}
        className={cx(
          'h-8 px-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium hover:bg-white/10 active:scale-[0.98]',
          open && 'bg-white/10',
        )}
      >
        <Sparkle size={13} weight="fill" className="text-gold" />
        Ask AI
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={comment}
        aria-label="Add comment"
        className="size-8 grid place-items-center text-white/70 hover:text-white hover:bg-white/10 border-l border-white/15 active:scale-[0.98]"
      >
        <ChatTeardropText size={14} />
      </button>
    </div>
  )

  return createPortal(
    <>
      {pill}
      {panel}
    </>,
    document.body,
  )
}
