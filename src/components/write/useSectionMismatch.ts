'use client'

import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { useProject } from '@/lib/store'
import { paragraphsOf, sectionOrderInDoc } from '@/lib/doc'

/**
 * Flags sections whose order in the essay no longer matches the plan.
 * Runs when the plan changes (returning from the Plan tab) and, cheaply,
 * on every saved document change.
 */
export function useSectionMismatch(editor: Editor | null) {
  const plan = useProject((s) => s.plan)
  const doc = useProject((s) => s.doc)
  const sources = useProject((s) => s.sources)
  const setSectionMismatch = useProject((s) => s.setSectionMismatch)

  useEffect(() => {
    if (!editor) return
    const inDoc = sectionOrderInDoc(paragraphsOf(doc, sources))
    const planOrder = plan.map((n) => n.id).filter((id) => inDoc.includes(id))
    const outOfOrder: string[] = []
    // Longest-common-subsequence-free heuristic: a section is out of order if
    // it appears before a section that precedes it in the plan.
    for (let i = 0; i < inDoc.length; i++) {
      const planIndex = planOrder.indexOf(inDoc[i])
      for (let j = 0; j < i; j++) {
        if (planOrder.indexOf(inDoc[j]) > planIndex) {
          outOfOrder.push(inDoc[i])
          break
        }
      }
    }
    setSectionMismatch({ outOfOrder })
  }, [editor, plan, doc, sources, setSectionMismatch])
}
