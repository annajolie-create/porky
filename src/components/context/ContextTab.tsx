'use client'

import { useRef, useState } from 'react'
import { FilePlus } from '@phosphor-icons/react/dist/csr/FilePlus'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { TabPage } from '../AppShell'
import { Button, ErrorNote, Field, Input, Select, SectionHeading, Textarea } from '../ui'
import { useProject } from '@/lib/store'
import { LANGUAGES, STYLES } from '@/lib/model'
import type { EssayStyle } from '@/lib/model'
import { newId } from '@/lib/ids'
import { countWords } from '@/lib/text'

export function ContextTab() {
  const context = useProject((s) => s.context)
  const title = useProject((s) => s.title)
  const setTitle = useProject((s) => s.setTitle)
  const update = useProject((s) => s.updateContext)
  const setTab = useProject((s) => s.setTab)

  return (
    <TabPage>
      <SectionHeading
        title="Context"
        description="What you have to deliver. Every AI feature in the app reads this, so the more precise it is, the better the plan, the drafts and the checks."
      />

      <div className="space-y-6">
        <Field label="Essay title" hint="Working title. You can change it any time from the Write tab.">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The case for a European digital euro" />
        </Field>

        <Field label="Task or question" hint="The exact wording from your course, if you have it.">
          <Textarea
            value={context.task}
            onChange={(e) => update({ task: e.target.value })}
            placeholder='e.g. "Assess the case for a European digital euro."'
            rows={3}
          />
        </Field>

        <Field label="Framework or instructions" hint="Course guidelines, required theories, structure requirements.">
          <Textarea
            value={context.framework}
            onChange={(e) => update({ framework: e.target.value })}
            placeholder="Optional"
            rows={3}
          />
        </Field>

        <GradingField />

        <div className="grid grid-cols-3 gap-4">
          <Field label="Length (words)">
            <Input
              type="number"
              min={100}
              step={100}
              value={context.lengthWords ?? ''}
              onChange={(e) => update({ lengthWords: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label="Style">
            <Select value={context.style} onChange={(e) => update({ style: e.target.value as EssayStyle })}>
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Language">
            <Select value={context.language} onChange={(e) => update({ language: e.target.value })}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <ReferencePieces />

        <div className="flex items-center justify-between pt-4 border-t border-line">
          <span className="text-[12.5px] text-muted">Saved automatically.</span>
          <Button variant="primary" onClick={() => setTab('sources')}>
            Next: Sources
          </Button>
        </div>
      </div>
    </TabPage>
  )
}

function GradingField() {
  const grading = useProject((s) => s.context.grading)
  const update = useProject((s) => s.updateContext)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Field label="Grading scheme or tutor comments" hint="Paste the rubric, or upload it as a PDF.">
      <Textarea value={grading} onChange={(e) => update({ grading: e.target.value })} placeholder="Optional" rows={4} />
      <div className="mt-2 flex items-center gap-3">
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
        <Button size="sm" loading={busy} onClick={() => input.current?.click()}>
          <FilePlus size={14} weight="bold" />
          Upload rubric PDF
        </Button>
        {error ? <ErrorNote message={error} /> : null}
      </div>
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
  const input = useRef<HTMLInputElement>(null)

  const add = (name: string, text: string) => {
    update({ referencePieces: [...pieces, { id: newId('ref'), name, text }] })
  }

  const upload = async (files: FileList) => {
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

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12.5px] font-medium text-ink-soft">Reference pieces</span>
        <span className="text-[12px] text-muted">Used for style and structure only, never cited.</span>
      </div>

      {pieces.length ? (
        <ul className="rounded-md border border-line bg-surface divide-y divide-line mb-2">
          {pieces.map((piece) => (
            <li key={piece.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
              <span className="flex-1 truncate">{piece.name}</span>
              <span className="text-muted tabular-nums text-[12px]">{countWords(piece.text).toLocaleString()} words</span>
              <button
                type="button"
                aria-label={`Remove ${piece.name}`}
                className="text-muted hover:text-ink rounded p-0.5"
                onClick={() => update({ referencePieces: pieces.filter((p) => p.id !== piece.id) })}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-2">
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
        <Button size="sm" loading={busy} onClick={() => input.current?.click()}>
          <FilePlus size={14} weight="bold" />
          Upload past essay
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPasteOpen((v) => !v)}>
          Paste text
        </Button>
      </div>

      {pasteOpen ? (
        <div className="mt-2 space-y-2 fade-in">
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
