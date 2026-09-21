'use client'

import { useRef, useState } from 'react'
import { EditorContent } from '@tiptap/react'
import { useProject } from '@/lib/store'
import { useEssayEditorContext } from './EditorContext'
import { Toolbar } from './Toolbar'
import { ParagraphGutter } from './ParagraphGutter'
import { SelectionMenu } from './SelectionMenu'
import { SuggestionToolbar } from './SuggestionToolbar'
import { CheckerPopover } from './CheckerPopover'
import { CitationPopover } from './CitationPopover'
import { ReferenceList } from './ReferenceList'

export function EssayPage() {
  const editor = useEssayEditorContext()
  const title = useProject((s) => s.title)
  const setTitle = useProject((s) => s.setTitle)
  const pageRef = useRef<HTMLDivElement>(null)
  const [citationPopover, setCitationPopover] = useState<{ sourceId: string; rect: DOMRect } | null>(null)

  return (
    <div className="px-8 py-8">
      <div className="no-print sticky top-0 z-10 -mt-2 mb-4 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">{editor ? <Toolbar editor={editor} /> : null}</div>
      </div>

      <article
        ref={pageRef}
        className="relative mx-auto max-w-[720px] rounded-md bg-surface shadow-page border border-line px-[64px] py-[56px] min-h-[calc(100vh-12rem)]"
        onClick={(event) => {
          const target = event.target as HTMLElement
          const citation = target.closest('.citation') as HTMLElement | null
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
          className="w-full bg-transparent font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] outline-none placeholder:text-muted/60 mb-6"
        />

        {editor ? (
          <>
            <ParagraphGutter editor={editor} container={pageRef} />
            <EditorContent editor={editor} />
            <SelectionMenu editor={editor} container={pageRef} />
            <SuggestionToolbar editor={editor} container={pageRef} />
            <CheckerPopover editor={editor} container={pageRef} />
          </>
        ) : (
          <p className="text-muted text-[13px]">Opening the essay</p>
        )}

        <ReferenceList />
      </article>

      {citationPopover ? (
        <CitationPopover sourceId={citationPopover.sourceId} anchor={citationPopover.rect} onClose={() => setCitationPopover(null)} />
      ) : null}
    </div>
  )
}
