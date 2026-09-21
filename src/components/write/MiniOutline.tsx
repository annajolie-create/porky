'use client'

import { useMemo } from 'react'
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { useProject } from '@/lib/store'
import { paragraphsOf } from '@/lib/doc'
import { addParagraphInSection, startWritingInSection } from '@/editor/commands'
import { isTextBlock } from '@/editor/paragraphIds'
import { useEssayEditorContext } from './EditorContext'
import { cx } from '../ui'

/** Section titles only; the current writing target highlighted; click to select. */
export function MiniOutline() {
  const editor = useEssayEditorContext()
  const plan = useProject((s) => s.plan)
  const doc = useProject((s) => s.doc)
  const sources = useProject((s) => s.sources)
  const activeParagraphId = useProject((s) => s.activeParagraphId)
  const checkerFlags = useProject((s) => s.checkerFlags)
  const checkersEnabled = useProject((s) => s.checkersEnabled)
  const setTab = useProject((s) => s.setTab)
  const mismatch = useProject((s) => s.sectionMismatch)

  const paragraphs = useMemo(() => paragraphsOf(doc, sources), [doc, sources])
  const activeSectionId = useMemo(() => {
    if (!editor || !activeParagraphId) return null
    let found: string | null = null
    editor.state.doc.descendants((node) => {
      if (found) return false
      if (isTextBlock(node.type.name) && node.attrs.id === activeParagraphId) {
        found = node.attrs.sectionId as string | null
        return false
      }
      return true
    })
    return found
  }, [editor, activeParagraphId, doc])

  const wordsBySection = useMemo(() => {
    const map = new Map<string | null, number>()
    for (const p of paragraphs) {
      const words = p.text.trim() ? p.text.trim().split(/\s+/).length : 0
      map.set(p.sectionId, (map.get(p.sectionId) ?? 0) + words)
    }
    return map
  }, [paragraphs])

  const flagsBySection = useMemo(() => {
    const map = new Map<string, string[]>()
    if (checkersEnabled) {
      for (const flag of Object.values(checkerFlags)) {
        if (flag.dismissed || !flag.planFit) continue
        const paragraph = paragraphs.find((p) => p.id === flag.paragraphId)
        if (!paragraph?.sectionId) continue
        ;(map.get(paragraph.sectionId) ?? map.set(paragraph.sectionId, []).get(paragraph.sectionId))!.push(
          flag.planFit.reason || 'A paragraph here does not fit this section.',
        )
      }
    }
    for (const id of mismatch.outOfOrder) {
      ;(map.get(id) ?? map.set(id, []).get(id))!.push('Appears in a different order than in the plan.')
    }
    return map
  }, [checkerFlags, checkersEnabled, paragraphs, mismatch])

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Plan outline</span>
        <span className="text-[11px] text-muted tabular-nums">{plan.length}</span>
      </div>

      {plan.length ? (
        <ol className="space-y-0.5">
          {plan.map((node, i) => {
            const active = node.id === activeSectionId
            const words = wordsBySection.get(node.id) ?? 0
            const flags = flagsBySection.get(node.id)
            return (
              <li key={node.id} className="group/row flex items-start gap-0.5">
                <button
                  type="button"
                  onClick={() => editor && startWritingInSection(editor, node.id, plan)}
                  title={flags?.join('\n') || (words ? 'Jump to this section' : 'Write towards this section')}
                  className={cx(
                    'flex-1 min-w-0 text-left rounded-lg px-2 py-1.5 flex items-start gap-2 transition-colors border-l-2',
                    active ? 'bg-surface text-ink shadow-soft border-gold' : 'text-ink-soft hover:bg-surface/70 border-transparent',
                  )}
                >
                  <span className={cx('mt-[4px] text-[12px] font-semibold tabular-nums w-4 shrink-0', active ? 'text-gold-ink' : 'text-muted')}>{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold leading-snug">{node.title}</span>
                    <span className="block text-[11px] text-muted tabular-nums mt-0.5">
                      {words ? words.toLocaleString() : 'Start writing'}
                      {node.targetWords ? ` / ${node.targetWords}` : words ? ' words' : ''}
                    </span>
                  </span>
                  {flags?.length ? <WarningCircle size={14} weight="fill" className="mt-[3px] text-warn shrink-0" aria-label={flags.join(' ')} /> : null}
                </button>
                <button
                  type="button"
                  aria-label={`New paragraph in ${node.title}`}
                  title="Start a new paragraph here"
                  onClick={() => editor && addParagraphInSection(editor, node.id, plan)}
                  className={cx(
                    'mt-1 size-6 grid place-items-center rounded text-muted hover:bg-paper hover:text-accent opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100',
                  )}
                >
                  <Plus size={12} weight="bold" />
                </button>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong px-3 py-5 text-center">
          <p className="text-[12.5px] text-muted leading-relaxed">No plan yet.</p>
          <button type="button" onClick={() => setTab('plan')} className="mt-2 text-[12.5px] font-medium text-accent hover:underline">
            Open Plan
          </button>
        </div>
      )}
    </div>
  )
}
