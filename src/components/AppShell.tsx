'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Books } from '@phosphor-icons/react/dist/csr/Books'
import { FileText } from '@phosphor-icons/react/dist/csr/FileText'
import { ListDashes } from '@phosphor-icons/react/dist/csr/ListDashes'
import { Note } from '@phosphor-icons/react/dist/csr/Note'
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { isBlankProject, loadDoc, projectSnapshot, takeCreateDocRequest, takeOpenDocRequest, upsertDoc } from '@/lib/documents'
import { useProject } from '@/lib/store'
import type { Tab } from '@/lib/model'
import { Button, cx } from './ui'
import { ContextTab } from './context/ContextTab'
import { SourcesTab } from './sources/SourcesTab'
import { PlanTab } from './plan/PlanTab'
import { WriteTab } from './write/WriteTab'
import { OpeningScreen } from './OpeningScreen'
import { useHydration } from './useHydration'

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'sources', label: 'Sources', icon: Books },
  { id: 'plan', label: 'Plan', icon: ListDashes },
  { id: 'write', label: 'Write', icon: PencilSimple },
]

const DOC_MENUS = ['File', 'Extensions', 'Help', 'Insert'] as const

export function AppShell() {
  const hydrated = useHydration()
  const tab = useProject((s) => s.tab)
  const setTab = useProject((s) => s.setTab)
  const title = useProject((s) => s.title)
  const setTitle = useProject((s) => s.setTitle)
  const [health, setHealth] = useState<{ hasKey: boolean } | null>(null)
  const [docReady, setDocReady] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    const apply = async () => {
      try {
        const createTitle = takeCreateDocRequest()
        if (createTitle != null) {
          useProject.getState().resetProject()
          useProject.getState().setTitle(createTitle)
        } else {
          const pendingId = takeOpenDocRequest()
          if (pendingId && pendingId !== useProject.getState().id) {
            const loaded = await loadDoc(pendingId)
            if (!cancelled && loaded) useProject.getState().loadProject(loaded)
          }
        }
      } catch {
        // Open the working copy even if a snapshot cannot be read.
      } finally {
        if (!cancelled) setDocReady(true)
      }
    }
    void apply()
    const fallback = window.setTimeout(() => {
      if (!cancelled) setDocReady(true)
    }, 800)
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
    }
  }, [hydrated])

  useEffect(() => {
    return () => {
      const current = projectSnapshot(useProject.getState())
      if (!isBlankProject(current)) void upsertDoc(current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const response = await fetch('/api/health', { cache: 'no-store' })
          if (!response.ok) throw new Error(`health ${response.status}`)
          const data = (await response.json()) as { hasKey?: boolean }
          if (!cancelled) setHealth({ hasKey: Boolean(data.hasKey) })
          return
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)))
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!hydrated || !docReady) {
    return <OpeningScreen label="Opening your project" />
  }

  return (
    <div className="h-full flex flex-col">
      <header className="no-print shrink-0 bg-surface border-b border-line">
        <div className="flex items-center gap-3 px-5 py-2.5">
          <Link href="/" className="shrink-0" aria-label="Workplace">
            <img src="/logo.svg" alt="" width={32} height={32} className="size-8" />
          </Link>

          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              aria-label="File name"
              className="w-full max-w-[420px] bg-transparent text-[15px] font-semibold tracking-[-0.02em] leading-tight outline-none truncate placeholder:text-muted"
            />
            <div className="flex items-center gap-0.5 mt-0.5 -ml-1.5 flex-wrap">
              {DOC_MENUS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="h-6 px-1.5 rounded text-[12.5px] font-medium text-muted hover:text-ink hover:bg-black/5 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3 shrink-0">
            <Button
              size="sm"
              variant={tab === 'context' ? 'soft' : 'secondary'}
              onClick={() => setTab('context')}
              aria-current={tab === 'context' ? 'page' : undefined}
              className="h-8 px-3"
            >
              <Note size={14} weight={tab === 'context' ? 'fill' : 'regular'} />
              Context
            </Button>
            {health && !health.hasKey ? (
              <span className="text-[12px] text-warn max-w-[220px] truncate">No OpenRouter key</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                <span className="size-[7px] rounded-full bg-ok" />
                Auto-saved
              </span>
            )}
            <span
              className="size-8 rounded-full bg-paper border border-line grid place-items-center text-[12px] font-semibold text-ink-soft"
              aria-hidden
            >
              A
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {tab === 'context' ? <ContextTab /> : null}
        {tab === 'sources' ? <SourcesTab /> : null}
        {tab === 'plan' ? <PlanTab /> : null}
        {tab === 'write' ? <WriteTab /> : null}
      </main>

      <ViewDock tab={tab} onTab={setTab} />
    </div>
  )
}

function ViewDock({
  tab,
  onTab,
}: {
  tab: Tab
  onTab: (tab: Tab) => void
}) {
  return (
    <nav
      className="no-print fixed z-40 bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-0 p-[9px] rounded-[28px] bg-surface shadow-dock border border-line/80"
      aria-label="Steps"
    >
      <div className="flex items-center">
        {TABS.map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'w-[64px] h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors',
                active ? 'bg-[#f6f3ea] text-ink' : 'text-muted hover:text-ink-soft',
              )}
            >
              <Icon size={16} weight={active ? 'fill' : 'regular'} className={active ? 'text-gold' : undefined} />
              <span className="text-[11px] font-medium leading-none">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Full-screen tab wrapper with a centred column. */
export function TabPage({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cx('mx-auto px-6 pt-11 pb-32', wide ? 'max-w-[1100px]' : 'max-w-[920px]')}>{children}</div>
    </div>
  )
}
