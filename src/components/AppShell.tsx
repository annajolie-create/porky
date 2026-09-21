'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Books } from '@phosphor-icons/react/dist/csr/Books'
import { FileText } from '@phosphor-icons/react/dist/csr/FileText'
import { ListDashes } from '@phosphor-icons/react/dist/csr/ListDashes'
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { rehydrateProject, useProject } from '@/lib/store'
import type { Tab } from '@/lib/model'
import { cx } from './ui'
import { ContextTab } from './context/ContextTab'
import { SourcesTab } from './sources/SourcesTab'
import { PlanTab } from './plan/PlanTab'
import { WriteTab } from './write/WriteTab'

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'sources', label: 'Sources', icon: Books },
  { id: 'plan', label: 'Plan', icon: ListDashes },
  { id: 'write', label: 'Write', icon: PencilSimple },
]

export function AppShell() {
  const hydrated = useProject((s) => s.hydrated)
  const tab = useProject((s) => s.tab)
  const setTab = useProject((s) => s.setTab)
  const title = useProject((s) => s.title)
  const setTitle = useProject((s) => s.setTitle)
  const [health, setHealth] = useState<{ hasKey: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    const stop = useProject.persist.onFinishHydration(() => {
      if (!cancelled) useProject.setState({ hydrated: true })
    })
    void rehydrateProject().catch(() => {
      if (!cancelled) useProject.setState({ hydrated: true })
    })
    const timeout = window.setTimeout(() => {
      if (!useProject.getState().hydrated) useProject.setState({ hydrated: true })
    }, 2000)
    return () => {
      cancelled = true
      stop()
      window.clearTimeout(timeout)
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

  if (!hydrated) {
    return (
      <div className="h-full grid place-items-center text-muted text-[13px]">Opening your project</div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <header className="no-print shrink-0 h-16 bg-surface border-b border-line flex items-center px-7 gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTab('write')}
            className="flex items-center gap-2.5 select-none"
            aria-label="essay"
          >
            <img src="/logo.svg" alt="" width={26} height={26} className="size-[26px]" />
            <span className="text-[17px] font-semibold tracking-[-0.03em] leading-none">essay</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('context')}
            aria-current={tab === 'context' ? 'page' : undefined}
            className={cx(
              'h-8 px-2.5 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors',
              tab === 'context' ? 'bg-[#f6f3ea] text-ink' : 'text-muted hover:text-ink-soft hover:bg-black/5',
            )}
          >
            <FileText size={14} weight={tab === 'context' ? 'fill' : 'regular'} />
            Context
          </button>
        </div>

        {tab === 'write' ? (
          <div id="header-center" className="flex-1 min-w-0 flex justify-center" />
        ) : (
          <div className="flex-1 min-w-0 flex justify-center">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled essay"
              aria-label="Essay title"
              className="w-full max-w-[420px] text-center text-[13px] text-muted bg-transparent outline-none truncate placeholder:text-muted/70"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 shrink-0">
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

export function HeaderPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setTarget(document.getElementById('header-center'))
  }, [])
  if (!target) return null
  return createPortal(children, target)
}

/** Full-screen tab wrapper with a centred column. */
export function TabPage({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cx('mx-auto px-6 pt-11 pb-32', wide ? 'max-w-[1100px]' : 'max-w-[920px]')}>{children}</div>
    </div>
  )
}
