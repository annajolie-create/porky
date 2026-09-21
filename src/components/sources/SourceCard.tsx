'use client'

import { useState } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { Trash } from '@phosphor-icons/react/dist/csr/Trash'
import { Button, Card, Dots, ErrorNote, cx } from '../ui'
import { useProject } from '@/lib/store'
import type { Source } from '@/lib/model'
import { countWords } from '@/lib/text'
import { summariseSource } from '@/lib/sources'

export function SourceCard({ source, compact }: { source: Source; compact?: boolean }) {
  const updateSource = useProject((s) => s.updateSource)
  const removeSource = useProject((s) => s.removeSource)
  const context = useProject((s) => s.context)
  const [showText, setShowText] = useState(false)

  const summarise = async () => {
    updateSource(source.id, { summaryStatus: 'loading', summaryError: undefined })
    try {
      const summary = await summariseSource(source, context)
      updateSource(source.id, { summary, summaryStatus: 'idle' })
    } catch (e) {
      updateSource(source.id, { summaryStatus: 'error', summaryError: (e as Error).message })
    }
  }

  return (
    <Card className={cx('p-5 h-full flex flex-col', compact && 'p-3')}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11.5px]">
            <span
              className={cx(
                'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
                source.type === 'pdf' ? 'bg-accent-soft text-gold-ink' : 'bg-paper text-muted',
              )}
            >
              {source.type === 'pdf' ? 'PDF' : 'LINK'}
            </span>
            <input
              value={source.year}
              onChange={(e) => updateSource(source.id, { year: e.target.value.replace(/[^0-9a-z.]/gi, '').slice(0, 6) })}
              aria-label="Year"
              placeholder="Year"
              className="ml-auto w-14 bg-transparent text-right outline-none rounded px-1 text-muted tabular-nums"
            />
          </div>
          <input
            value={source.title}
            onChange={(e) => updateSource(source.id, { title: e.target.value })}
            aria-label="Title"
            className="w-full bg-transparent text-[16px] font-semibold text-ink leading-snug outline-none rounded px-0 mt-2 focus:bg-paper"
            placeholder="Title"
          />
          <input
            value={source.authors.join(', ')}
            onChange={(e) =>
              updateSource(source.id, {
                authors: e.target.value
                  .split(/[,;]/)
                  .map((a) => a.trim())
                  .filter(Boolean),
              })
            }
            aria-label="Authors"
            placeholder="Authors, comma separated"
            className="w-full bg-transparent outline-none rounded px-0 mt-1 text-[13px] text-muted focus:bg-paper"
          />
        </div>
        <button
          type="button"
          onClick={() => removeSource(source.id)}
          aria-label="Remove source"
          className="text-muted hover:text-del rounded p-1 -m-1 transition-colors"
        >
          <Trash size={15} />
        </button>
      </div>

      {!compact ? (
        <p className="mt-3 text-[13.5px] text-ink-soft leading-relaxed">
          {source.snippet}
          {source.text.length > source.snippet.length ? (
            <button type="button" onClick={() => setShowText((v) => !v)} className="ml-1 text-accent hover:underline text-[12.5px]">
              {showText ? 'Hide text' : 'Show text'}
            </button>
          ) : null}
        </p>
      ) : null}

      {showText ? (
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-paper p-3 text-[12px] leading-relaxed text-ink-soft font-sans">
          {source.text}
        </pre>
      ) : null}

      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[12px] text-muted hover:text-accent truncate max-w-full"
        >
          <ArrowSquareOut size={12} />
          {(() => {
            try {
              return new URL(source.url).hostname
            } catch {
              return source.url
            }
          })()}
        </a>
      ) : (
        <p className="mt-2 text-[12px] text-muted tabular-nums">{countWords(source.text).toLocaleString()} words</p>
      )}

      <div className="mt-auto pt-4 border-t border-line">
        {source.summaryStatus === 'loading' ? (
          <Dots label="Summarising for your task" />
        ) : source.summary ? (
          <div className="fade-in">
            <div className="rounded-xl bg-accent-soft/70 px-3.5 py-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-gold-ink mb-1.5">
                Summary · relates to your question
              </p>
              <p className="text-[13px] leading-relaxed text-ink">{source.summary}</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={summarise} className="text-[12.5px] text-muted hover:text-ink">
                Re-summarise
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" className="border-gold/40 text-gold-ink hover:bg-accent-soft" onClick={summarise}>
              Summarise
            </Button>
            {source.summaryStatus === 'error' && source.summaryError ? (
              <div className="flex-1">
                <ErrorNote message={source.summaryError} onRetry={summarise} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  )
}
