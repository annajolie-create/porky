'use client'

import { useMemo } from 'react'
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { useProject } from '@/lib/store'
import { paragraphsOf } from '@/lib/doc'
import { scrollToSection } from '@/editor/commands'
import { useEssayEditorContext } from './EditorContext'
import { cx } from '../ui'

/** Section titles only; the current one highlighted; click to jump. */
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
      if (node.type.name === 'paragraph' && node.attrs.id === activeParagraphId) {
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
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Outline</span>
        <button
          type="button"
          onClick={() => setTab('plan')}
          className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-accent"
          title="Edit the plan"
        >
          <PencilSimple size={12} />
          Edit plan
        </button>
      </div>

      {plan.length ? (
        <ol className="space-y-0.5">
          {plan.map((node, i) => {
            const active = node.id === activeSectionId
            const words = wordsBySection.get(node.id) ?? 0
            const flags = flagsBySection.get(node.id)
            return (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => editor && scrollToSection(editor, node.id)}
                  title={flags?.join('\n')}
                  className={cx(
                    'w-full text-left rounded-md px-2 py-1.5 flex items-start gap-2 transition-colors',
                    active ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-paper',
                  )}
                >
                  <span className={cx('mt-[3px] text-[10.5px] tabular-nums w-3 shrink-0', active ? 'text-accent' : 'text-muted')}>{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] leading-snug truncate">{node.title}</span>
                    <span className="block text-[11px] text-muted tabular-nums mt-0.5">
                      {words ? words.toLocaleString() : '–'}
                      {node.targetWords ? ` / ${node.targetWords}` : ''} words
                    </span>
                  </span>
                  {flags?.length ? <WarningCircle size={14} weight="fill" className="mt-[3px] text-warn shrink-0" aria-label={flags.join(' ')} /> : null}
                </button>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="px-2 text-[12.5px] text-muted leading-relaxed">
          No plan yet.{' '}
          <button type="button" onClick={() => setTab('plan')} className="text-accent hover:underline">
            Build one
          </button>{' '}
          so the agent and the checkers know your argument.
        </p>
      )}
    </div>
  )
}
