'use client'

import { useState } from 'react'
import { Quotes } from '@phosphor-icons/react/dist/csr/Quotes'
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight'
import { useProject } from '@/lib/store'
import { inTextCitation } from '@/lib/apa'
import { useEssayEditorContext } from './EditorContext'
import { cx } from '../ui'

/** Compact list of sources; click for the summary, button to cite at the caret. */
export function SourcesWindow() {
  const editor = useEssayEditorContext()
  const sources = useProject((s) => s.sources)
  const setTab = useProject((s) => s.setTab)
  const requestCitationCheck = useProject((s) => s.requestCitationCheck)
  const [openId, setOpenId] = useState<string | null>(null)

  const cite = (sourceId: string) => {
    if (!editor) return
    const source = sources.find((s) => s.id === sourceId)
    if (!source) return
    const label = inTextCitation(source)
    editor.chain().focus().insertCitation({ sourceId, label }).run()
    requestCitationCheck(sourceId)
  }

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Sources</span>
        <button type="button" onClick={() => setTab('sources')} className="text-[11.5px] text-muted hover:text-accent">
          Manage
        </button>
      </div>
      {sources.length ? (
        <ul className="space-y-0.5">
          {sources.map((source) => {
            const open = openId === source.id
            return (
              <li key={source.id} className="rounded-md">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : source.id)}
                    className="flex-1 min-w-0 text-left rounded-md px-2 py-1.5 hover:bg-paper flex items-center gap-1.5"
                    aria-expanded={open}
                  >
                    <CaretRight size={11} className={cx('text-muted shrink-0 transition-transform', open && 'rotate-90')} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12.5px] leading-snug truncate text-ink-soft">{source.title}</span>
                      <span className="block text-[11px] text-muted truncate">{inTextCitation(source)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => cite(source.id)}
                    aria-label={`Cite ${source.title}`}
                    title="Insert citation at the cursor"
                    className="shrink-0 size-7 grid place-items-center rounded text-muted hover:text-accent hover:bg-accent-soft"
                  >
                    <Quotes size={14} weight="bold" />
                  </button>
                </div>
                {open ? (
                  <div className="mx-2 mb-2 rounded-md bg-paper px-2.5 py-2 text-[12px] leading-relaxed text-ink-soft fade-in">
                    {source.summary ?? (
                      <span className="text-muted">
                        No summary yet.{' '}
                        <button type="button" onClick={() => setTab('sources')} className="text-accent hover:underline">
                          Summarise
                        </button>
                      </span>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-2 text-[12.5px] text-muted">
          No sources.{' '}
          <button type="button" onClick={() => setTab('sources')} className="text-accent hover:underline">
            Add some
          </button>
          .
        </p>
      )}
    </div>
  )
}
