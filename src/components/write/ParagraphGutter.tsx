'use client'

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { useProject } from '@/lib/store'
import { reassignParagraph } from '@/editor/commands'
import { cx } from '../ui'

type Marker = { id: string; sectionId: string | null; top: number; height: number }

/**
 * Thin bars in the left margin showing which plan section each paragraph
 * belongs to. Hover shows the section number; click reassigns.
 */
export function ParagraphGutter({ editor, container }: { editor: Editor; container: RefObject<HTMLElement | null> }) {
  const plan = useProject((s) => s.plan)
  const activeParagraphId = useProject((s) => s.activeParagraphId)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [menuFor, setMenuFor] = useState<string | null>(null)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const root = container.current
      if (!root) return
      const rootRect = root.getBoundingClientRect()
      const nodes = editor.view.dom.querySelectorAll<HTMLElement>('p[data-pid]')
      const next: Marker[] = []
      nodes.forEach((el) => {
        if (!el.textContent?.trim()) return
        const rect = el.getBoundingClientRect()
        next.push({
          id: el.getAttribute('data-pid') as string,
          sectionId: el.getAttribute('data-section'),
          top: rect.top - rootRect.top,
          height: rect.height,
        })
      })
      setMarkers(next)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    schedule()
    editor.on('transaction', schedule)
    window.addEventListener('resize', schedule)
    const observer = new ResizeObserver(schedule)
    observer.observe(editor.view.dom)
    return () => {
      editor.off('transaction', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [editor, container])

  const activeSection = markers.find((m) => m.id === activeParagraphId)?.sectionId ?? null
  const indexOf = (sectionId: string | null) => plan.findIndex((n) => n.id === sectionId)

  return (
    <div className="no-print absolute left-0 top-0 bottom-0 w-[64px] pointer-events-none select-none" aria-hidden={!plan.length}>
      {markers.map((m) => {
        const index = indexOf(m.sectionId)
        const isActive = m.sectionId && m.sectionId === activeSection
        const open = menuFor === m.id
        return (
          <div key={m.id} className="absolute left-[30px] pointer-events-auto group" style={{ top: m.top, height: m.height }}>
            <button
              type="button"
              onClick={() => setMenuFor(open ? null : m.id)}
              aria-label={index >= 0 ? `Section ${index + 1}: ${plan[index].title}. Click to reassign.` : 'Assign to a section'}
              title={index >= 0 ? plan[index].title : 'No section'}
              className={cx(
                'block h-full w-[3px] rounded-full transition-colors',
                isActive ? 'bg-accent' : index >= 0 ? 'bg-line-strong group-hover:bg-muted' : 'bg-transparent border border-dashed border-line-strong',
              )}
            />
            <span
              className={cx(
                'absolute -left-[22px] top-0 text-[10.5px] tabular-nums text-muted opacity-0 group-hover:opacity-100 transition-opacity',
                isActive && 'opacity-100 text-accent',
              )}
            >
              {index >= 0 ? index + 1 : '–'}
            </span>
            {open ? (
              <div className="absolute left-3 top-0 z-20 w-[240px] rounded-md border border-line bg-surface shadow-soft p-1 fade-in">
                <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted">Move paragraph to</p>
                {plan.map((node, i) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      reassignParagraph(editor, m.id, node.id)
                      setMenuFor(null)
                    }}
                    className={cx(
                      'w-full text-left px-2 py-1.5 rounded text-[12.5px] hover:bg-paper flex items-center gap-2',
                      node.id === m.sectionId && 'text-accent',
                    )}
                  >
                    <span className="text-muted tabular-nums w-4">{i + 1}</span>
                    <span className="truncate">{node.title}</span>
                  </button>
                ))}
                {!plan.length ? <p className="px-2 py-1.5 text-[12.5px] text-muted">Create a plan first.</p> : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
