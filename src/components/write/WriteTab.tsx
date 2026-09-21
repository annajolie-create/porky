'use client'

import { useEffect, useState } from 'react'
import { Export } from '@phosphor-icons/react/dist/csr/Export'
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { SidebarSimple } from '@phosphor-icons/react/dist/csr/SidebarSimple'
import { useProject } from '@/lib/store'
import { Button, Switch, cx } from '../ui'
import { HeaderPortal } from '../AppShell'
import { EditorContext } from './EditorContext'
import { useEssayEditor } from './useEssayEditor'
import { EssayPage } from './EssayPage'
import { MiniOutline } from './MiniOutline'
import { SourcesWindow } from './SourcesWindow'
import { AgentPanel } from './AgentPanel'
import { CommentRail } from './CommentRail'
import { ExportDialog } from './ExportDialog'
import { CheckDialog } from '../check/CheckTab'
import { Toolbar } from './Toolbar'
import { useLiveCheckers } from './useLiveCheckers'
import { useSectionMismatch } from './useSectionMismatch'
import { useSpellcheck } from './useSpellcheck'

export function WriteTab() {
  const editor = useEssayEditor()
  const task = useProject((s) => s.context.task)
  const target = useProject((s) => s.context.lengthWords)
  const sidebarOpen = useProject((s) => s.sidebarOpen)
  const setSidebarOpen = useProject((s) => s.setSidebarOpen)
  const checkersEnabled = useProject((s) => s.checkersEnabled)
  const setCheckersEnabled = useProject((s) => s.setCheckersEnabled)
  const setTab = useProject((s) => s.setTab)
  const comments = useProject((s) => s.comments)
  const [exportOpen, setExportOpen] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)
  const [words, setWords] = useState(0)

  useLiveCheckers(editor)
  useSectionMismatch(editor)
  useSpellcheck(editor)

  useEffect(() => {
    if (!editor) return
    const update = () => setWords(editor.storage.characterCount.words())
    update()
    editor.on('update', update)
    return () => {
      editor.off('update', update)
    }
  }, [editor])

  const openComments = comments.filter((c) => !c.resolved)
  const showRail = openComments.length > 0

  return (
    <EditorContext.Provider value={editor}>
      {editor ? (
        <HeaderPortal>
          <Toolbar editor={editor} />
        </HeaderPortal>
      ) : null}
      <div className="h-full flex flex-col">
        <div className="no-print shrink-0 h-11 bg-paper/80 border-b border-line flex items-center gap-3 px-4 text-[12.5px]">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-pressed={sidebarOpen}
            className="p-1.5 rounded-lg text-muted hover:bg-black/5 hover:text-ink"
          >
            <SidebarSimple size={16} />
          </button>
          <p className="flex-1 min-w-0 truncate text-ink-soft">
            <span className="inline-flex items-center h-5 px-1.5 rounded bg-accent-soft text-gold-ink text-[10.5px] font-semibold uppercase tracking-[0.06em] mr-2">
              Task
            </span>
            {task.trim() || (
              <button type="button" onClick={() => setTab('context')} className="text-muted italic hover:text-ink-soft hover:underline">
                No task yet. Add one in Context.
              </button>
            )}
          </p>
          <Switch checked={checkersEnabled} onChange={setCheckersEnabled} label="Checkers" />
          <span className="tabular-nums text-muted shrink-0">
            {words.toLocaleString()}
            {target ? ` / ${target.toLocaleString()}` : ''} words
          </span>
          <Button size="sm" onClick={() => setCheckOpen(true)}>
            <ShieldCheck size={14} weight="bold" />
            Check
          </Button>
          <Button size="sm" onClick={() => setExportOpen(true)}>
            <Export size={14} weight="bold" />
            Export PDF
          </Button>
        </div>

        <div className="flex-1 min-h-0 flex">
          <aside
            className={cx(
              'no-print shrink-0 border-r border-line bg-paper flex flex-col transition-[width] duration-200 overflow-hidden',
              sidebarOpen ? 'w-[248px]' : 'w-0 border-r-0',
            )}
            aria-hidden={!sidebarOpen}
          >
            <div className="flex-1 min-h-0 flex flex-col w-[248px] pb-24">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <MiniOutline />
              </div>
              <div className="shrink-0 border-t border-line max-h-[45%] overflow-y-auto">
                <SourcesWindow />
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0 flex">
            <div className="flex-1 min-w-0 overflow-y-auto">
              <EssayPage words={words} target={target} />
            </div>
            {showRail ? (
              <div className="no-print w-[260px] shrink-0 border-l border-line bg-paper overflow-y-auto">
                <CommentRail />
              </div>
            ) : null}
          </div>

          <aside className="no-print w-[320px] shrink-0 border-l border-line bg-surface flex flex-col min-h-0">
            <AgentPanel />
          </aside>
        </div>
      </div>

      {checkOpen ? <CheckDialog onClose={() => setCheckOpen(false)} /> : null}
      {exportOpen ? <ExportDialog onClose={() => setExportOpen(false)} /> : null}
    </EditorContext.Provider>
  )
}
