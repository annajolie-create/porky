import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { saveDocument } from '../storage/documents'
import type { DocumentMeta } from '../storage/types'

const DELAY = 500

export type SaveState = 'saved' | 'saving'

/**
 * Saves only what changed, and only once something actually has. The previous
 * version wrote to storage on every mount, which under StrictMode meant two
 * writes and a "Saving" flash before the writer had typed anything.
 */
export function useAutosave({
  editor,
  meta,
  onSaved,
  onError,
}: {
  editor: Editor | null
  meta: DocumentMeta
  onSaved: (meta: DocumentMeta) => void
  onError: (message: string) => void
}) {
  const [state, setState] = useState<SaveState>('saved')
  const timer = useRef(0)
  const dirty = useRef(false)
  const latest = useRef({ editor, meta, onSaved, onError })

  useEffect(() => {
    latest.current = { editor, meta, onSaved, onError }
  })

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return

    const { editor, meta, onSaved, onError } = latest.current
    if (!editor) return

    dirty.current = false
    try {
      onSaved(await saveDocument(meta, editor.getJSON()))
      setState('saved')
    } catch {
      dirty.current = true
      setState('saved')
      onError('Could not save to this browser. Your changes are only in this tab.')
    }
  }, [])

  const schedule = useCallback(() => {
    dirty.current = true
    setState('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), DELAY)
  }, [flush])

  useEffect(() => {
    if (!editor) return
    editor.on('update', schedule)
    return () => {
      editor.off('update', schedule)
    }
  }, [editor, schedule])

  // The title is chrome state, not editor state, so it needs its own trigger.
  const title = meta.title
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    schedule()
  }, [title, schedule])

  useEffect(() => {
    const onHide = () => {
      // Mobile Safari never fires beforeunload, so visibilitychange carries
      // the last few keystrokes when a tab is closed or backgrounded.
      if (document.visibilityState === 'hidden') void flush()
    }
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onHide)
      window.clearTimeout(timer.current)
    }
  }, [flush])

  return { state, flush }
}
