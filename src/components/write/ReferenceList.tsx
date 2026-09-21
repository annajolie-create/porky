'use client'

import { useMemo } from 'react'
import { useProject } from '@/lib/store'
import { citedSourceIds } from '@/lib/doc'
import { referenceEntry, sortForReferenceList } from '@/lib/apa'

/** APA reference list generated from every citation in the essay. */
export function ReferenceList() {
  const doc = useProject((s) => s.doc)
  const sources = useProject((s) => s.sources)

  const cited = useMemo(() => {
    const ids = new Set(citedSourceIds(doc))
    return sortForReferenceList(sources.filter((s) => ids.has(s.id)))
  }, [doc, sources])

  if (!cited.length) return null

  return (
    <section className="mt-12 pt-6 border-t border-line font-serif" aria-label="References">
      <h2 className="text-[15px] font-semibold mb-3">References</h2>
      <ul className="space-y-2 text-[14.5px] leading-relaxed text-ink">
        {cited.map((s) => (
          <li key={s.id} className="pl-8 -indent-8">
            {referenceEntry(s)}
          </li>
        ))}
      </ul>
    </section>
  )
}
