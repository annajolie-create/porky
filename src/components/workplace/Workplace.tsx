'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { clearOpenDocRequest, formatAgo, isBlankProject, listDocs, loadDoc, projectSnapshot, removeDoc, requestCreateDoc, requestOpenDoc, upsertDoc, type DocRecord } from '@/lib/documents'
import { useProject } from '@/lib/store'
import { useHydration } from '../useHydration'
import { Button, Input, cx } from '../ui'

export function Workplace() {
  const router = useRouter()
  const hydrated = useHydration()
  const [docs, setDocs] = useState<DocRecord[]>([])
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      try {
        const current = projectSnapshot(useProject.getState())
        if (current.id && (!isBlankProject(current) || (await listDocs()).some((d) => d.id === current.id))) {
          await upsertDoc(current)
        }
        const next = await listDocs()
        if (!cancelled) setDocs(next)
      } catch {
        if (!cancelled) setDocs([])
      }
    }
    if (hydrated) void sync()
    return () => {
      cancelled = true
    }
  }, [hydrated])

  const refresh = async () => setDocs(await listDocs())

  const openDoc = (id: string) => {
    const current = projectSnapshot(useProject.getState())
    const go = async () => {
      if (current.id !== id && !isBlankProject(current)) await upsertDoc(current)
      requestOpenDoc(id)
      const loaded = await loadDoc(id)
      if (loaded) useProject.getState().loadProject(loaded)
      router.push('/doc')
    }
    void go()
  }

  const createDoc = (title: string) => {
    const current = projectSnapshot(useProject.getState())
    if (!isBlankProject(current)) void upsertDoc(current)
    const nextTitle = title.trim() || 'Untitled'
    clearOpenDocRequest()
    requestCreateDoc(nextTitle)
    useProject.getState().resetProject()
    useProject.getState().setTitle(nextTitle)
    setNaming(false)
    router.push('/doc')
  }

  const deleteDoc = async (id: string) => {
    await removeDoc(id)
    if (useProject.getState().id === id) useProject.getState().resetProject()
    await refresh()
  }

  return (
    <div className="h-full flex flex-col">
      <header className="no-print shrink-0 h-[60px] bg-surface border-b border-line flex items-center px-6 gap-3">
        <img src="/logo.svg" alt="" width={32} height={32} className="size-8" />
        <span className="text-[17px] font-semibold tracking-[-0.03em]">Essai</span>
        <span className="text-[13px] text-muted">Workplace</span>
        <span
          className="ml-auto size-8 rounded-full bg-paper border border-line grid place-items-center text-[12px] font-semibold text-ink-soft"
          aria-hidden
        >
          A
        </span>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-[960px] px-6 pt-12 pb-20">
          <h1 className="font-serif text-[32px] font-semibold tracking-[-0.02em] leading-none">Workplace</h1>
          <p className="text-[15px] text-muted mt-3 max-w-[54ch] leading-relaxed">
            Your essays on this device. Open one, or start a blank document.
          </p>

          <section className="mt-10">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted mb-4">New</h2>
            <button type="button" onClick={() => { setName(''); setNaming(true) }} className="group w-[168px] text-left">
              <span
                className={cx(
                  'block aspect-[3/4] rounded-xl border border-dashed border-line-strong bg-surface/70 grid place-items-center',
                  'transition-colors group-hover:border-gold group-hover:bg-accent-soft/40',
                )}
              >
                <span className="size-10 rounded-xl bg-gold-soft text-gold-ink grid place-items-center group-hover:bg-gold group-hover:text-ink transition-colors">
                  <Plus size={20} weight="bold" />
                </span>
              </span>
              <span className="block mt-3 text-[13.5px] font-semibold">Blank document</span>
              <span className="block text-[12px] text-muted mt-0.5">Start writing</span>
            </button>
          </section>

          <section className="mt-12">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted mb-4">Recents</h2>
            {docs.length ? (
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
                {docs.map((doc) => (
                  <li key={doc.id}>
                    <DocCard doc={doc} onOpen={() => openDoc(doc.id)} onDelete={() => void deleteDoc(doc.id)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted">No documents yet. Create a blank one to begin.</p>
            )}
          </section>
        </div>
      </main>

      {naming ? (
        <NameDialog name={name} onChange={setName} onCancel={() => setNaming(false)} onCreate={() => createDoc(name)} />
      ) : null}
    </div>
  )
}

function NameDialog({
  name,
  onChange,
  onCancel,
  onCreate,
}: {
  name: string
  onChange: (value: string) => void
  onCancel: () => void
  onCreate: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/30" onClick={onCancel} />
      <form
        role="dialog"
        aria-labelledby="name-doc-title"
        aria-modal="true"
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(420px,calc(100vw-32px))] rounded-2xl border border-line bg-surface shadow-page p-5 fade-in"
        onSubmit={(e) => {
          e.preventDefault()
          onCreate()
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id="name-doc-title" className="text-[16px] font-semibold">
            Name this document
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="p-1 text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <p className="text-[13.5px] text-ink-soft leading-relaxed mb-4">
          This is the file name in your workplace. You can change it later.
        </p>
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Untitled"
          aria-label="Document name"
          autoComplete="off"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Create
          </Button>
        </div>
      </form>
    </>
  )
}

function DocCard({
  doc,
  onOpen,
  onDelete,
}: {
  doc: DocRecord
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <div className="group relative">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <span className="block aspect-[3/4] rounded-xl border border-line bg-surface shadow-soft px-4 py-4 overflow-hidden transition-colors group-hover:border-line-strong">
          {doc.preview ? (
            <span className="block font-serif text-[11.5px] leading-[1.55] text-ink-soft line-clamp-6 whitespace-pre-wrap">
              {doc.preview}
            </span>
          ) : (
            <span className="block font-serif text-[11.5px] text-muted italic">Empty document</span>
          )}
        </span>
        <span className="block mt-3 text-[13.5px] font-semibold truncate">{doc.title}</span>
        <span className="block text-[12px] text-muted mt-0.5">{formatAgo(doc.updatedAt)}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDelete()
        }}
        aria-label={`Delete ${doc.title}`}
        className="absolute top-2 right-2 size-7 rounded-lg bg-surface/90 border border-line text-muted grid place-items-center opacity-0 group-hover:opacity-100 hover:text-del hover:border-del/30 hover:bg-del-bg transition-opacity"
      >
        <X size={12} />
      </button>
    </div>
  )
}
