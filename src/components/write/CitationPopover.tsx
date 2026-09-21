'use client'

import { useEffect, useRef } from 'react'
import { useProject } from '@/lib/store'
import { SourceCard } from '../sources/SourceCard'

export function CitationPopover({ sourceId, anchor, onClose }: { sourceId: string; anchor: DOMRect; onClose: () => void }) {
  const source = useProject((s) => s.sources.find((x) => x.id === sourceId))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!source) return null

  const width = 380
  const left = Math.min(Math.max(12, anchor.left + anchor.width / 2 - width / 2), window.innerWidth - width - 12)
  const top = Math.min(anchor.bottom + 8, window.innerHeight - 320)

  return (
    <div ref={ref} className="fixed z-40 fade-in" style={{ left, top, width }}>
      <SourceCard source={source} compact />
    </div>
  )
}
