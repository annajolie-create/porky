'use client'

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { ChatTeardropText } from '@phosphor-icons/react/dist/csr/ChatTeardropText'
import { useProject } from '@/lib/store'
import { newId } from '@/lib/ids'
import { paragraphAt } from '@/editor/paragraphIds'
import { selectedText } from '@/editor/commands'
import { cx } from '../ui'

const ACTIONS: { id: string; label: string; prompt: (text: string) => string }[] = [
  {
    id: 'improve',
    label: 'Improve',
    prompt: (t) => `Improve this selected text. Keep the meaning and voice. Propose an edit to the paragraph.\n\n"""${t}"""`,
  },
  {
    id: 'shorten',
    label: 'Shorten',
    prompt: (t) => `Shorten this selected text without losing the claim. Propose an edit.\n\n"""${t}"""`,
  },
  {
    id: 'expand',
    label: 'Expand',
    prompt: (t) => `Expand this selected text with one more supporting point from the sources. Propose an edit.\n\n"""${t}"""`,
  },
  {
    id: 'source',
    label: 'Find source',
    prompt: (t) => `Find the best source for this claim and propose an edit that adds an APA citation.\n\n"""${t}"""`,
  },
]

export function SelectionMenu({ editor }: { editor: Editor; container: RefObject<HTMLElement | null> }) {
  const requestAgent = useProject((s) => s.requestAgent)
  const addComment = useProject((s) => s.addComment)
  const setActiveComment = useProject((s) => s.setActiveComment)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    const update = () => {
      const { from, to } = editor.state.selection
      if (from === to) {
        setCoords(null)
        setOpen(false)
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
        top: Math.min(start.top, end.top) - 8,
        left: (start.left + end.left) / 2,
      })
      setText(sel)
    }
    editor.on('selectionUpdate', update)
    editor.on('blur', () => {
      // Keep the menu if the user is clicking it; hide on a real empty selection.
      window.setTimeout(() => {
        if (editor.state.selection.empty) {
          setCoords(null)
          setOpen(false)
        }
      }, 150)
    })
    return () => {
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  if (!coords) return null

  const ask = (prompt: string) => {
    const found = paragraphAt(editor.state.doc, editor.state.selection.from)
    requestAgent({ prompt, paragraphId: (found?.node.attrs.id as string) ?? undefined, selection: text })
    setOpen(false)
    editor.commands.focus()
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

  return (
    <div
      className="no-print fixed z-30 -translate-x-1/2 -translate-y-full fade-in"
      style={{ top: coords.top, left: coords.left }}
    >
      <div className="inline-flex items-center rounded-full bg-ink text-white shadow-soft overflow-hidden">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
          className={cx(
            'h-8 px-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium hover:bg-white/10',
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
          className="size-8 grid place-items-center text-white/70 hover:text-white hover:bg-white/10 border-l border-white/15"
        >
          <ChatTeardropText size={14} />
        </button>
      </div>
      {open ? (
        <div className="mt-1 w-[200px] rounded-xl border border-line bg-surface shadow-soft p-1 fade-in">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => ask(a.prompt(text))}
              className="w-full text-left px-2 py-1.5 rounded text-[12.5px] hover:bg-paper"
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const custom = window.prompt('What should the agent do with this text?')
              if (custom?.trim()) ask(`${custom.trim()}\n\n"""${text}"""`)
            }}
            className="w-full text-left px-2 py-1.5 rounded text-[12.5px] hover:bg-paper text-muted"
          >
            Custom prompt…
          </button>
        </div>
      ) : null}
    </div>
  )
}
