'use client'

import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { FilePdf } from '@phosphor-icons/react/dist/csr/FilePdf'
import { LinkSimple } from '@phosphor-icons/react/dist/csr/LinkSimple'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { TabPage } from '../AppShell'
import { Button, Dots, EmptyState, ErrorNote, Input, SectionHeading, cx } from '../ui'
import { useProject } from '@/lib/store'
import { sourceFromFile, sourceFromUrl } from '@/lib/sources'
import { SourceCard } from './SourceCard'
import { TopicSearch } from './TopicSearch'

export function SourcesTab() {
  const sources = useProject((s) => s.sources)
  const addSource = useProject((s) => s.addSource)
  const [pending, setPending] = useState<string[]>([])
  const [errors, setErrors] = useState<{ id: string; message: string; retry: () => void }[]>([])
  const [url, setUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [adding, setAdding] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const track = async (label: string, run: () => Promise<void>, retry: () => void) => {
    setPending((p) => [...p, label])
    try {
      await run()
    } catch (e) {
      setErrors((errs) => [...errs, { id: Math.random().toString(36).slice(2), message: `${label}: ${(e as Error).message}`, retry }])
    } finally {
      setPending((p) => {
        const index = p.indexOf(label)
        return index === -1 ? p : [...p.slice(0, index), ...p.slice(index + 1)]
      })
    }
  }

  const addFiles = (files: File[]) => {
    for (const file of files) {
      const go = () => void track(file.name, async () => addSource(await sourceFromFile(file)), go)
      go()
    }
    setAdding(false)
  }

  const addUrl = () => {
    const value = url.trim()
    if (!value) return
    setUrl('')
    const go = () => void track(value, async () => addSource(await sourceFromUrl(value)), go)
    go()
    setAdding(false)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files ?? []).filter((f) => /pdf|text/.test(f.type) || /\.(pdf|txt|md)$/i.test(f.name))
    if (files.length) addFiles(files)
    const text = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
    if (!files.length && text && /^https?:\/\//i.test(text.trim())) {
      setUrl(text.trim())
      setAdding(true)
    }
  }

  const showAdd = adding || !sources.length

  return (
    <TabPage wide>
      <SectionHeading
        title="Sources"
        description="Everything the AI can read, summarise and search."
        actions={
          <Button variant="primary" onClick={() => setAdding((v) => !v)}>
            <Plus size={15} weight="bold" />
            Add source
          </Button>
        }
      />

      {sources.length ? <TopicSearch /> : null}

      {showAdd ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            'rounded-2xl border border-dashed px-6 py-8 text-center transition-colors mt-6',
            dragging ? 'border-gold bg-accent-soft/40' : 'border-line-strong bg-surface/50',
          )}
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="application/pdf,.pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(Array.from(e.target.files))
              e.target.value = ''
            }}
          />
          <p className="text-[14px] font-medium">Drop PDFs here, or add a link</p>
          <p className="text-[12.5px] text-muted mt-0.5">Papers, reports, or articles you want to cite.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button onClick={() => fileInput.current?.click()}>
              <FilePdf size={15} weight="bold" />
              Choose PDF
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2 max-w-[520px] mx-auto">
            <div className="relative flex-1">
              <LinkSimple size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addUrl()
                }}
                placeholder="Paste a link to an article"
                className="pl-9 h-11"
              />
            </div>
            <Button onClick={addUrl} disabled={!url.trim()}>
              Add link
            </Button>
          </div>
        </div>
      ) : null}

      {pending.length ? (
        <div className="mt-4 space-y-1.5">
          {pending.map((label, i) => (
            <div key={`${label}-${i}`} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 fade-in">
              <Dots label={`Reading ${label}`} />
            </div>
          ))}
        </div>
      ) : null}

      {errors.length ? (
        <div className="mt-4 space-y-1.5">
          {errors.map((err) => (
            <ErrorNote
              key={err.id}
              message={err.message}
              onRetry={() => {
                setErrors((errs) => errs.filter((e) => e.id !== err.id))
                err.retry()
              }}
            />
          ))}
        </div>
      ) : null}

      <div className={cx(sources.length ? 'mt-6' : 'mt-8')}>
        {sources.length ? (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sources.map((source) => (
              <li key={source.id}>
                <SourceCard source={source} />
              </li>
            ))}
          </ul>
        ) : !pending.length && !showAdd ? (
          <EmptyState title="No sources yet" body="Add at least one source before building the plan. The AI will only cite what is here." />
        ) : !sources.length && !pending.length ? null : null}
      </div>
    </TabPage>
  )
}
