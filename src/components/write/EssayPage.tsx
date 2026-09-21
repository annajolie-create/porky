'use client'

import { useRef, useState } from 'react'
import { EditorContent } from '@tiptap/react'
import { useProject } from '@/lib/store'
import { useEssayEditorContext } from './EditorContext'
import { ParagraphGutter } from './ParagraphGutter'
import { SelectionMenu } from './SelectionMenu'
import { SuggestionToolbar } from './SuggestionToolbar'
import { CheckerPopover } from './CheckerPopover'
import { CitationPopover } from './CitationPopover'
import { SpellPopover } from './SpellPopover'
import { ReferenceList } from './ReferenceList'

export function EssayPage({ words, target }: { words?: number; target?: number | null }) {
  const editor = useEssayEditorContext()
  const title = useProject((s) => s.title)
  const setTitle = useProject((s) => s.setTitle)
  const plan = useProject((s) => s.plan)
  const activeParagraphId = useProject((s) => s.activeParagraphId)
  const pageRef = useRef<HTMLDivElement>(null)
  const [citationPopover, setCitationPopover] = useState<{ sourceId: string; rect: DOMRect } | null>(null)

  const activeSection = (() => {
    if (!editor || !activeParagraphId) return null
    let sectionId: string | null = null
    editor.state.doc.descendants((node) => {
      if (sectionId) return false
      if (node.type.name === 'paragraph' && node.attrs.id === activeParagraphId) {
        sectionId = node.attrs.sectionId as string | null
        return false
      }
      return true
    })
    if (!sectionId) return null
    const index = plan.findIndex((n) => n.id === sectionId)
    if (index < 0) return null
    return { index, title: plan[index].title }
  })()

  return (
    <div className="px-10 py-10 pb-28">
      <article
        ref={pageRef}
        className="relative mx-auto max-w-[720px] rounded-sm bg-surface shadow-page px-[72px] py-[64px] min-h-[calc(100vh-10rem)]"
        onClick={(event) => {
          const targetEl = event.target as HTMLElement
          const citation = targetEl.closest('.citation') as HTMLElement | null
          if (citation && pageRef.current) {
            const sourceId = citation.getAttribute('data-source-id')
            if (sourceId) {
              setCitationPopover({ sourceId, rect: citation.getBoundingClientRect() })
              return
            }
          }
          setCitationPopover(null)
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Essay title"
          aria-label="Essay title"
          className="w-full bg-transparent font-serif text-[34px] font-semibold leading-[1.15] tracking-[-0.02em] outline-none placeholder:text-muted/60 mb-8"
        />

        {editor ? (
          <>
            <ParagraphGutter editor={editor} container={pageRef} />
            <EditorContent editor={editor} />
            <SelectionMenu editor={editor} container={pageRef} />
            <SuggestionToolbar editor={editor} container={pageRef} />
            <CheckerPopover editor={editor} container={pageRef} />
            <SpellPopover editor={editor} />
          </>
        ) : (
          <p className="text-muted text-[13px]">Opening the essay</p>
        )}

        <ReferenceList />

        <div className="mt-10 pt-4 border-t border-line flex items-center justify-between text-[12px] text-muted">
          <span>
            {activeSection ? `Section ${activeSection.index + 1} · ${activeSection.title}` : 'Draft'}
          </span>
          <span className="tabular-nums">
            {(words ?? 0).toLocaleString()}
            {target ? ` / ${target.toLocaleString()}` : ''} words
          </span>
        </div>
      </article>

      {citationPopover ? (
        <CitationPopover sourceId={citationPopover.sourceId} anchor={citationPopover.rect} onClose={() => setCitationPopover(null)} />
      ) : null}
    </div>
  )
}
