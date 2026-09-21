'use client'

import { useEffect, useState } from 'react'
import { Export } from '@phosphor-icons/react/dist/csr/Export'
import { SidebarSimple } from '@phosphor-icons/react/dist/csr/SidebarSimple'
import { useProject } from '@/lib/store'
import { Button, cx } from '../ui'
import { EditorContext } from './EditorContext'
import { useEssayEditor } from './useEssayEditor'
import { EssayPage } from './EssayPage'
import { MiniOutline } from './MiniOutline'
import { SourcesWindow } from './SourcesWindow'
import { AgentPanel } from './AgentPanel'
import { CommentRail } from './CommentRail'
import { ExportDialog } from './ExportDialog'
import { useLiveCheckers } from './useLiveCheckers'
import { useSectionMismatch } from './useSectionMismatch'

export function WriteTab() {
  const editor = useEssayEditor()
  const task = useProject((s) => s.context.task)
  const target = useProject((s) => s.context.lengthWords)
  const sidebarOpen = useProject((s) => s.sidebarOpen)
  const setSidebarOpen = useProject((s) => s.setSidebarOpen)
  const checkersEnabled = useProject((s) => s.checkersEnabled)
  const setCheckersEnabled = useProject((s) => s.setCheckersEnabled)
  const comments = useProject((s) => s.comments)
  const [exportOpen, setExportOpen] = useState(false)
  const [words, setWords] = useState(0)

  useLiveCheckers(editor)
  useSectionMismatch(editor)

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
      <div className="h-full flex flex-col">
        <div className="no-print shrink-0 h-10 border-b border-line bg-surface flex items-center gap-3 px-3 text-[12.5px]">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-pressed={sidebarOpen}
            className="p-1.5 rounded text-muted hover:bg-black/5 hover:text-ink"
          >
            <SidebarSimple size={16} />
          </button>
          <p className="flex-1 min-w-0 truncate text-ink-soft">
            <span className="text-muted mr-1.5">Task</span>
            {task.trim() || <span className="text-muted italic">No task yet. Add one in Context.</span>}
          </p>
          <span className="tabular-nums text-muted shrink-0">
            {words.toLocaleString()}
            {target ? ` / ${target.toLocaleString()}` : ''} words
          </span>
          <label className="inline-flex items-center gap-1.5 text-muted cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={checkersEnabled}
              onChange={(e) => setCheckersEnabled(e.target.checked)}
              className="accent-accent size-3.5"
            />
            Live checks
          </label>
          <Button size="sm" onClick={() => setExportOpen(true)}>
            <Export size={14} weight="bold" />
            Export PDF
          </Button>
        </div>

        <div className="flex-1 min-h-0 flex">
          <aside
            className={cx(
              'no-print shrink-0 border-r border-line bg-surface flex flex-col transition-[width] duration-200 overflow-hidden',
              sidebarOpen ? 'w-[236px]' : 'w-0 border-r-0',
            )}
            aria-hidden={!sidebarOpen}
          >
            <div className="flex-1 min-h-0 flex flex-col w-[236px]">
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
              <EssayPage />
            </div>
            {showRail ? (
              <div className="no-print w-[260px] shrink-0 border-l border-line bg-paper overflow-y-auto">
                <CommentRail />
              </div>
            ) : null}
          </div>

          <aside className="no-print w-[340px] shrink-0 border-l border-line bg-surface flex flex-col min-h-0">
            <AgentPanel />
          </aside>
        </div>
      </div>

      {exportOpen ? <ExportDialog onClose={() => setExportOpen(false)} /> : null}
    </EditorContext.Provider>
  )
}
