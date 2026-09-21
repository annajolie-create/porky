'use client'

import { useEffect } from 'react'
import { rehydrateProject, useProject } from '@/lib/store'

export function useHydration() {
  const hydrated = useProject((s) => s.hydrated)

  useEffect(() => {
    let cancelled = false
    const stop = useProject.persist.onFinishHydration(() => {
      if (!cancelled) useProject.setState({ hydrated: true })
    })
    void rehydrateProject().catch(() => {
      if (!cancelled) useProject.setState({ hydrated: true })
    })
    const timeout = window.setTimeout(() => {
      if (!useProject.getState().hydrated) useProject.setState({ hydrated: true })
    }, 600)
    return () => {
      cancelled = true
      stop()
      window.clearTimeout(timeout)
    }
  }, [])

  return hydrated
}
