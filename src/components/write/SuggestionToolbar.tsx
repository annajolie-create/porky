'use client'

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { Check } from '@phosphor-icons/react/dist/csr/Check'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise'
import { useProject } from '@/lib/store'
import { acceptSuggestion, rejectSuggestion } from '@/editor/applySuggestion'
import { findParagraph } from '@/editor/paragraphIds'

export function SuggestionToolbar({ editor }: { editor: Editor; container: RefObject<HTMLElement | null> }) {
  const suggestions = useProject((s) => s.suggestions)
  const sources = useProject((s) => s.sources)
  const removeSuggestion = useProject((s) => s.removeSuggestion)
  const requestAgent = useProject((s) => s.requestAgent)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      const { from } = editor.state.selection
      let id: string | null = null
      const $pos = editor.state.doc.resolve(from)
      $pos.marks().forEach((mark) => {
        if (mark.type.name === 'sgIns' || mark.type.name === 'sgDel') id = mark.attrs.suggestionId as string
      })
      if (!id) {
        for (let d = $pos.depth; d > 0; d--) {
          const node = $pos.node(d)
          if (node.type.name === 'paragraph') {
            const match = suggestions.find((s) => s.paragraphId === node.attrs.id)
            if (match) id = match.id
            break
          }
        }
      }
      setActiveId(id)
    }
    editor.on('selectionUpdate', update)
    update()
    return () => {
      editor.off('selectionUpdate', update)
    }
  }, [editor, suggestions])

  const suggestion = suggestions.find((s) => s.id === activeId)
  if (!suggestion) return null

  const found = findParagraph(editor.state.doc, suggestion.paragraphId)
  if (!found) return null
  const coords = editor.view.coordsAtPos(found.pos + 1)

  return (
    <div
      className="no-print fixed z-20 fade-in inline-flex items-center gap-0.5 rounded-md border border-line bg-surface shadow-soft p-0.5"
      style={{ top: coords.top - 36, left: coords.left }}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          acceptSuggestion(editor, suggestion, sources)
          removeSuggestion(suggestion.id)
        }}
        className="h-7 px-2 inline-flex items-center gap-1 rounded text-[12px] font-medium text-ins hover:bg-ins-bg"
      >
        <Check size={13} weight="bold" />
        Accept
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          rejectSuggestion(editor, suggestion)
          removeSuggestion(suggestion.id)
        }}
        className="h-7 px-2 inline-flex items-center gap-1 rounded text-[12px] font-medium text-del hover:bg-del-bg"
      >
        <X size={13} />
        Reject
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const note = window.prompt('How should this suggestion change?')
          if (!note?.trim()) return
          requestAgent({
            paragraphId: suggestion.paragraphId,
            prompt: `Iterate on the pending suggestion for paragraph ${suggestion.paragraphId}. Current proposed text:\n"""${suggestion.newText}"""\n\nInstruction: ${note.trim()}`,
          })
        }}
        className="h-7 px-2 inline-flex items-center gap-1 rounded text-[12px] font-medium text-ink-soft hover:bg-paper"
      >
        <ArrowsClockwise size={13} />
        Iterate
      </button>
    </div>
  )
}
