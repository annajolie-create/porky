'use client'

import { useEffect, useState } from 'react'
import { rehydrateProject, useProject } from '@/lib/store'
import type { Tab } from '@/lib/model'
import { cx } from './ui'
import { ContextTab } from './context/ContextTab'
import { SourcesTab } from './sources/SourcesTab'
import { PlanTab } from './plan/PlanTab'
import { WriteTab } from './write/WriteTab'
import { CheckTab } from './check/CheckTab'

const TABS: { id: Tab; label: string; step: number }[] = [
  { id: 'context', label: 'Context', step: 1 },
  { id: 'sources', label: 'Sources', step: 2 },
  { id: 'plan', label: 'Plan', step: 3 },
  { id: 'write', label: 'Write', step: 4 },
  { id: 'check', label: 'Check', step: 5 },
]

export function AppShell() {
  const hydrated = useProject((s) => s.hydrated)
  const tab = useProject((s) => s.tab)
  const setTab = useProject((s) => s.setTab)
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
      <header className="no-print shrink-0 h-12 border-b border-line bg-surface/80 backdrop-blur flex items-center px-4 gap-6">
        <div className="flex items-center gap-2 select-none">
          <span className="size-5 rounded-[6px] bg-accent grid place-items-center text-white text-[11px] font-bold">P</span>
          <span className="text-[13.5px] font-semibold tracking-[-0.01em]">Porky</span>
        </div>
        <nav className="flex items-center gap-1" aria-label="Steps">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'h-8 px-3 rounded-md text-[13px] font-medium inline-flex items-center gap-2 transition-colors',
                  active ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-black/5',
                )}
              >
                <span
                  className={cx(
                    'size-4 rounded-full grid place-items-center text-[10.5px] font-semibold tabular-nums',
                    active ? 'bg-accent text-white' : 'bg-line text-muted',
                  )}
                >
                  {t.step}
                </span>
                {t.label}
              </button>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[12px] text-muted">
          {health && !health.hasKey ? (
            <span className="text-warn">No OpenRouter key: AI features are off. See .env.example.</span>
          ) : null}
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {tab === 'context' ? <ContextTab /> : null}
        {tab === 'sources' ? <SourcesTab /> : null}
        {tab === 'plan' ? <PlanTab /> : null}
        {tab === 'write' ? <WriteTab /> : null}
        {tab === 'check' ? <CheckTab /> : null}
      </main>
    </div>
  )
}

/** Full-screen tab wrapper with a centred column. */
export function TabPage({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cx('mx-auto px-6 py-10', wide ? 'max-w-[1100px]' : 'max-w-[760px]')}>{children}</div>
    </div>
  )
}
