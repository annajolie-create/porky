'use client'

import { useEffect } from 'react'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { useProject } from '@/lib/store'
import { paragraphsOf, citedSourceIds } from '@/lib/doc'
import { referenceEntry, sortForReferenceList } from '@/lib/apa'
import { Button } from '../ui'

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const title = useProject((s) => s.title)
  const doc = useProject((s) => s.doc)
  const sources = useProject((s) => s.sources)
  const suggestions = useProject((s) => s.suggestions)
  const paragraphs = paragraphsOf(doc, sources).filter((p) => p.text.trim())
  const cited = sortForReferenceList(sources.filter((s) => citedSourceIds(doc).includes(s.id)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const print = () => {
    window.print()
  }

  return (
    <>
      <div className="no-print fixed inset-0 z-40 bg-ink/30" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="export-title"
        className="no-print fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] rounded-lg border border-line bg-surface shadow-page p-5 fade-in"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id="export-title" className="text-[16px] font-semibold">
            Export PDF
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <p className="text-[13.5px] text-ink-soft leading-relaxed">
          Your browser’s print dialog will save a clean A4 PDF: title, essay and APA references. Suggestions, comments and
          checker marks are left out.
        </p>
        {suggestions.length ? (
          <p className="mt-3 text-[13px] text-warn bg-warn-bg rounded-md px-3 py-2">
            {suggestions.length} pending suggestion{suggestions.length === 1 ? '' : 's'} will not appear in the export.
            Accept or reject them first if you want those edits in the PDF.
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={print}>
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="export-view print-only">
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '22pt', margin: '0 0 1.2em' }}>
          {title.trim() || 'Untitled essay'}
        </h1>
        {paragraphs.map((p) => (
          <p key={p.id} style={{ fontFamily: 'Georgia, serif', fontSize: '12pt', lineHeight: 1.7, margin: '0 0 1em' }}>
            {p.text}
          </p>
        ))}
        {cited.length ? (
          <section style={{ marginTop: '2.5em' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '14pt', margin: '0 0 0.8em' }}>References</h2>
            {cited.map((s) => (
              <p
                key={s.id}
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '11pt',
                  lineHeight: 1.5,
                  margin: '0 0 0.7em',
                  paddingLeft: '1.5em',
                  textIndent: '-1.5em',
                }}
              >
                {referenceEntry(s)}
              </p>
            ))}
          </section>
        ) : null}
      </div>
    </>
  )
}
