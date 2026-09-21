'use client'

import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { FilePlus } from '@phosphor-icons/react/dist/csr/FilePlus'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { TabPage } from '../AppShell'
import { Button, ErrorNote, Field, Input, SectionHeading, Textarea, cx } from '../ui'
import { Dropdown } from '../Menu'
import { selectContextDrifted, useProject } from '@/lib/store'
import { LANGUAGES, STYLES } from '@/lib/model'
import type { EssayStyle } from '@/lib/model'
import { newId } from '@/lib/ids'

export function ContextTab() {
  const context = useProject((s) => s.context)
  const update = useProject((s) => s.updateContext)
  const setTab = useProject((s) => s.setTab)
  const drifted = useProject(selectContextDrifted)

  return (
    <TabPage>
      <SectionHeading
        title="Context"
        description="Everything the AI reads about your assignment. Saved automatically as you type."
      />

      {drifted ? (
        <div className="mb-7 flex items-start justify-between gap-4 rounded-2xl border border-warn/35 bg-warn-bg px-4 py-3.5">
          <p className="text-[13.5px] text-ink-soft leading-relaxed">
            You changed the assignment after the plan was built. Update the plan so the editor and the agent stay in sync.
          </p>
          <Button variant="primary" className="shrink-0" onClick={() => setTab('plan')}>
            Update plan
          </Button>
        </div>
      ) : null}

      <div className="space-y-7">
        <Field label="Task or question">
          <Textarea
            value={context.task}
            onChange={(e) => update({ task: e.target.value })}
            placeholder="The exact wording from your course, if you have it."
            rows={3}
          />
        </Field>

        <Field label="Framework & instructions" optional>
          <Textarea
            value={context.framework}
            onChange={(e) => update({ framework: e.target.value })}
            placeholder="Course guidelines, required theories, structure requirements."
            rows={3}
          />
        </Field>

        <GradingField />

        <div className="grid grid-cols-3 gap-4">
          <Field label="Length">
            <div className="relative">
              <Input
                type="number"
                min={100}
                step={100}
                value={context.lengthWords ?? ''}
                onChange={(e) => update({ lengthWords: e.target.value ? Number(e.target.value) : null })}
                className="pr-20"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-lg bg-paper text-[12.5px] text-muted grid place-items-center">
                words
              </span>
            </div>
          </Field>
          <Field label="Style">
            <Dropdown
              label="Style"
              value={context.style}
              onChange={(style) => update({ style: style as EssayStyle })}
              options={STYLES}
            />
          </Field>
          <Field label="Language">
            <Dropdown
              label="Language"
              value={context.language}
              onChange={(language) => update({ language })}
              options={LANGUAGES.map((l) => ({ value: l, label: l }))}
            />
          </Field>
        </div>

        <ReferencePieces />
      </div>
    </TabPage>
  )
}

function GradingField() {
  const grading = useProject((s) => s.context.grading)
  const update = useProject((s) => s.updateContext)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('meta', 'false')
      const response = await fetch('/api/sources/extract', { method: 'POST', body: form })
      const data = (await response.json()) as { text?: string; error?: string }
      if (!response.ok || !data.text) throw new Error(data.error ?? 'Could not read that file.')
      update({ grading: grading ? `${grading}\n\n${data.text}` : data.text })
      setFileName(file.name)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Field label="Grading scheme or tutor comments" optional>
      <div className="relative">
        <Textarea
          value={grading}
          onChange={(e) => {
            update({ grading: e.target.value })
            if (!e.target.value) setFileName(null)
          }}
          placeholder="Upload the marking rubric or paste tutor comments."
          rows={3}
          className="pb-14"
        />
        <div className="absolute left-3 bottom-3 flex items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
              e.target.value = ''
            }}
          />
          {fileName ? (
            <span className="inline-flex items-center gap-2 h-9 pl-2 pr-2 rounded-lg bg-paper border border-line text-[12.5px]">
              <span className="size-5 rounded bg-gold grid place-items-center text-[10px] font-bold text-ink">PDF</span>
              {fileName}
              <button
                type="button"
                aria-label={`Remove ${fileName}`}
                className="text-muted hover:text-ink px-0.5"
                onClick={() => {
                  setFileName(null)
                  update({ grading: '' })
                }}
              >
                <X size={12} />
              </button>
            </span>
          ) : (
            <Button size="sm" loading={busy} onClick={() => input.current?.click()}>
              <FilePlus size={14} weight="bold" />
              Upload rubric
            </Button>
          )}
        </div>
      </div>
      {error ? <div className="mt-2"><ErrorNote message={error} /></div> : null}
    </Field>
  )
}

function ReferencePieces() {
  const pieces = useProject((s) => s.context.referencePieces)
  const update = useProject((s) => s.updateContext)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const add = (name: string, text: string) => {
    update({ referencePieces: [...pieces, { id: newId('ref'), name, text }] })
  }

  const upload = async (files: FileList | File[]) => {
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('file', file)
        form.append('meta', 'false')
        const response = await fetch('/api/sources/extract', { method: 'POST', body: form })
        const data = (await response.json()) as { text?: string; error?: string }
        if (!response.ok || !data.text) throw new Error(data.error ?? `Could not read ${file.name}.`)
        add(file.name.replace(/\.[a-z0-9]+$/i, ''), data.text)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files?.length) void upload(event.dataTransfer.files)
  }

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[13px] font-semibold text-ink">Reference pieces</span>
        <span className="text-[12px] text-muted">optional</span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'rounded-2xl border border-dashed px-6 pt-10 pb-20 text-center transition-colors',
          dragging ? 'border-gold bg-accent-soft/50' : 'border-line-strong bg-surface/40',
        )}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,.pdf,.txt,.md"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mx-auto size-9 rounded-xl bg-gold-soft text-gold-ink grid place-items-center mb-3 hover:bg-gold transition-colors"
          aria-label="Upload reference pieces"
        >
          <Plus size={18} weight="bold" />
        </button>
        <p className="text-[14px] font-medium">Drop past essays or model answers, or click to upload</p>
        <p className="text-[12.5px] text-muted mt-1">Used for style and structure only — never cited as a source</p>

        {pieces.length ? (
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {pieces.map((piece) => (
              <li key={piece.id} className="inline-flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-lg bg-paper border border-line text-[12.5px]">
                <span className="size-4 rounded bg-line-strong/80" />
                <span className="max-w-[220px] truncate">{piece.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${piece.name}`}
                  className="text-muted hover:text-ink rounded p-0.5"
                  onClick={() => update({ referencePieces: pieces.filter((p) => p.id !== piece.id) })}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4">
          <button type="button" onClick={() => setPasteOpen((v) => !v)} className="text-[12.5px] text-muted hover:text-ink">
            {pasteOpen ? 'Cancel paste' : 'Or paste text'}
          </button>
        </div>
      </div>

      {busy ? <p className="mt-2 text-[12.5px] text-muted">Reading file…</p> : null}

      {pasteOpen ? (
        <div className="mt-3 space-y-2 fade-in">
          <Textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste a model answer or a past essay" rows={5} />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={!pasteText.trim()}
              onClick={() => {
                add(`Pasted text ${pieces.length + 1}`, pasteText.trim())
                setPasteText('')
                setPasteOpen(false)
              }}
            >
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-2"><ErrorNote message={error} /></div> : null}
    </div>
  )
}
