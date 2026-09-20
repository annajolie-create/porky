import { useCallback, useEffect, useState } from 'react'
import {
  bootstrap,
  createDocument,
  deleteDocument,
  duplicateDocument,
  readBody,
  renameDocument,
  setActiveId,
} from '../storage/documents'
import type { DocumentBody, DocumentMeta } from '../storage/types'

type Ready = {
  status: 'ready'
  metas: DocumentMeta[]
  active: DocumentMeta
  body: DocumentBody
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | Ready

const byRecency = (a: DocumentMeta, b: DocumentMeta) => b.updatedAt - a.updatedAt

export function useDocuments() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    bootstrap()
      .then(({ metas, active, body }) => {
        if (!cancelled) setState({ status: 'ready', metas, active, body })
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              'This browser will not let Porky store documents. Private windows and blocked site data both do this.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const patchMeta = useCallback((next: DocumentMeta) => {
    setState((current) => {
      if (current.status !== 'ready') return current
      const metas = current.metas.map((meta) => (meta.id === next.id ? next : meta))
      metas.sort(byRecency)
      return {
        ...current,
        metas,
        active: current.active.id === next.id ? next : current.active,
      }
    })
  }, [])

  const open = useCallback(async (id: string) => {
    const body = await readBody(id)
    setState((current) => {
      if (current.status !== 'ready') return current
      const active = current.metas.find((meta) => meta.id === id)
      if (!active || !body) return current
      setActiveId(active.id)
      return { ...current, active, body }
    })
  }, [])

  const adopt = useCallback((meta: DocumentMeta, body: DocumentBody) => {
    setActiveId(meta.id)
    setState((current) => {
      if (current.status !== 'ready') return current
      const metas = [meta, ...current.metas].sort(byRecency)
      return { ...current, metas, active: meta, body }
    })
  }, [])

  const create = useCallback(async () => {
    const { meta, body } = await createDocument()
    adopt(meta, body)
  }, [adopt])

  const duplicate = useCallback(
    async (meta: DocumentMeta) => {
      const copy = await duplicateDocument(meta)
      adopt(copy.meta, copy.body)
    },
    [adopt],
  )

  const rename = useCallback(
    async (meta: DocumentMeta, title: string) => {
      patchMeta(await renameDocument(meta, title))
    },
    [patchMeta],
  )

  const remove = useCallback(
    async (meta: DocumentMeta) => {
      if (state.status !== 'ready') return
      await deleteDocument(meta.id)

      const remaining = state.metas.filter((entry) => entry.id !== meta.id).sort(byRecency)

      // Deleting something other than what is open changes only the list.
      if (meta.id !== state.active.id) {
        setState((current) =>
          current.status === 'ready' ? { ...current, metas: remaining } : current,
        )
        return
      }

      if (!remaining.length) {
        // Never leave the writer staring at nothing.
        const { meta: fresh, body } = await createDocument()
        setState((current) =>
          current.status === 'ready'
            ? { ...current, metas: [fresh], active: fresh, body }
            : current,
        )
        setActiveId(fresh.id)
        return
      }

      const next = remaining[0]
      const body = await readBody(next.id)
      if (!body) return
      setActiveId(next.id)
      setState((current) =>
        current.status === 'ready'
          ? { ...current, metas: remaining, active: next, body }
          : current,
      )
    },
    [state],
  )

  return { state, open, create, duplicate, rename, remove, patchMeta }
}
