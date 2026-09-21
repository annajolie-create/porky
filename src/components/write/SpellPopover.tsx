'use client'

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ignoreWord, matchCase } from '@/lib/spell'
import { spellKey, type SpellIssue } from '@/editor/spellcheck'
import { cx } from '../ui'

export function SpellPopover({ editor }: { editor: Editor }) {
  const [issue, setIssue] = useState<SpellIssue | null>(null)

  useEffect(() => {
    const openFromSpan = (span: Element) => {
      const issues = spellKey.getState(editor.state)?.issues ?? []
      const word = span.textContent ?? ''
      let pos = -1
      try {
        pos = editor.view.posAtDOM(span, 0)
      } catch {
        pos = -1
      }
      const hit =
        issues.find((item) => pos >= item.from && pos < item.to) ??
        issues.find((item) => item.word === word)
      setIssue(hit ?? null)
    }
    const onOpen = (event: Event) => {
      const hit = (event as CustomEvent<SpellIssue | null>).detail
      setIssue(hit ?? null)
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-spell-pop]')) return
      const span = target?.closest('.sp-error')
      if (!span || !editor.view.dom.contains(span)) {
        setIssue(null)
        return
      }
      openFromSpan(span)
    }
    const onMenu = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest('.sp-error')) event.preventDefault()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIssue(null)
    }
    const onUpdate = () => {
      setIssue((current) => {
        if (!current) return null
        const issues = spellKey.getState(editor.state)?.issues ?? []
        return issues.find((item) => item.from === current.from && item.word === current.word) ?? null
      })
    }
    const dom = editor.view.dom
    dom.addEventListener('spell-open', onOpen)
    window.addEventListener('mousedown', onPointer)
    dom.addEventListener('contextmenu', onMenu)
    window.addEventListener('keydown', onKey)
    editor.on('update', onUpdate)
    return () => {
      dom.removeEventListener('spell-open', onOpen)
      window.removeEventListener('mousedown', onPointer)
      dom.removeEventListener('contextmenu', onMenu)
      window.removeEventListener('keydown', onKey)
      editor.off('update', onUpdate)
    }
  }, [editor])

  if (!issue) return null

  let coords: { top: number; bottom: number; left: number; right: number }
  try {
    const start = editor.view.coordsAtPos(issue.from)
    const end = editor.view.coordsAtPos(issue.to)
    coords = {
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
      left: Math.min(start.left, end.left),
      right: Math.max(start.right, end.right),
    }
  } catch {
    return null
  }

  const apply = (suggestion: string) => {
    const replacement = matchCase(issue.word, suggestion)
    editor.view.dispatch(editor.state.tr.insertText(replacement, issue.from, issue.to))
    editor.view.focus()
    setIssue(null)
  }

  const width = 200
  const left = Math.min(Math.max(12, (coords.left + coords.right) / 2 - width / 2), window.innerWidth - width - 12)
  const placeAbove = coords.bottom + 8 + 220 > window.innerHeight
  const top = placeAbove ? Math.max(12, coords.top - 8) : coords.bottom + 6

  return (
    <div
      data-spell-pop
      role="listbox"
      aria-label={`Spelling suggestions for ${issue.word}`}
      className={cx(
        'no-print fixed z-30 w-[200px] rounded-xl border border-line bg-surface shadow-soft p-1 fade-in',
        placeAbove && '-translate-y-full',
      )}
      style={{ top, left }}
    >
      <p className="px-2.5 pt-1.5 pb-1 text-[12px] text-muted truncate">{issue.word}</p>
      {issue.suggestions.length ? (
        <ul>
          {issue.suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => apply(suggestion)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] text-ink hover:bg-paper active:scale-[0.99]"
              >
                {matchCase(issue.word, suggestion)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2.5 py-1.5 text-[13px] text-muted">No suggestions</p>
      )}
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          ignoreWord(issue.word)
          setIssue(null)
        }}
        className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] text-muted hover:bg-paper hover:text-ink"
      >
        Ignore
      </button>
    </div>
  )
}
