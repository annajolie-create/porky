import { useCallback, useRef, useState } from 'react'
import { DocumentEditor } from './editor/DocumentEditor'
import { DocumentDrawer } from './library/DocumentDrawer'
import { useDocuments } from './library/useDocuments'

export default function App() {
  const { state, open, create, duplicate, rename, remove, patchMeta } = useDocuments()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const flushRef = useRef<() => Promise<void>>(async () => {})

  const registerFlush = useCallback((flush: () => Promise<void>) => {
    flushRef.current = flush
  }, [])

  // Switching documents remounts the editor, which would discard a pending
  // debounce, so the outgoing document is written first.
  const withFlush = useCallback(
    (action: () => void | Promise<void>) => async () => {
      await flushRef.current()
      await action()
    },
    [],
  )

  if (state.status === 'loading') {
    return (
      <div className="app app-centred">
        <p className="page-loading">Opening your documents</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="app app-centred">
        <div className="notice-card" role="alert">
          <h1>Porky cannot save here</h1>
          <p>{state.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {drawerOpen ? (
        <DocumentDrawer
          metas={state.metas}
          activeId={state.active.id}
          onClose={() => setDrawerOpen(false)}
          onOpenDocument={(id) => {
            void withFlush(async () => {
              await open(id)
              setDrawerOpen(false)
            })()
          }}
          onCreate={() => {
            void withFlush(async () => {
              await create()
              setDrawerOpen(false)
            })()
          }}
          onRename={(meta, title) => void rename(meta, title)}
          onDuplicate={(meta) => {
            void withFlush(async () => {
              await duplicate(meta)
              setDrawerOpen(false)
            })()
          }}
          onDelete={(meta) => void withFlush(() => remove(meta))()}
        />
      ) : null}

      <DocumentEditor
        key={state.active.id}
        meta={state.active}
        body={state.body}
        onSaved={patchMeta}
        onRename={(meta, title) => void rename(meta, title)}
        onOpenDrawer={() => setDrawerOpen(true)}
        registerFlush={registerFlush}
      />
    </div>
  )
}
