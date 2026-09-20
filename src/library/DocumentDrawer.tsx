import { useEffect, useRef, useState } from 'react'
import { Files } from '@phosphor-icons/react/dist/csr/Files'
import { FilePlus } from '@phosphor-icons/react/dist/csr/FilePlus'
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { TrashSimple } from '@phosphor-icons/react/dist/csr/TrashSimple'
import { X } from '@phosphor-icons/react/dist/csr/X'
import type { DocumentMeta } from '../storage/types'
import { relativeTime } from './relativeTime'

type Props = {
  metas: DocumentMeta[]
  activeId: string
  onClose: () => void
  onOpenDocument: (id: string) => void
  onCreate: () => void
  onRename: (meta: DocumentMeta, title: string) => void
  onDuplicate: (meta: DocumentMeta) => void
  onDelete: (meta: DocumentMeta) => void
}

/** Mounted only while open, so rename and confirm state resets by itself. */
export function DocumentDrawer({
  metas,
  activeId,
  onClose,
  onOpenDocument,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const newButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    newButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" aria-label="Documents">
        <div className="drawer-head">
          <h2 className="drawer-title">
            <Files size={16} weight="bold" />
            Documents
          </h2>
          <button type="button" className="tool-btn" aria-label="Close" title="Close" onClick={onClose}>
            <X size={16} weight="bold" />
          </button>
        </div>

        <button ref={newButton} type="button" className="drawer-new" onClick={onCreate}>
          <FilePlus size={16} weight="bold" />
          New document
        </button>

        <ul className="drawer-list">
          {metas.map((meta) => {
            const isActive = meta.id === activeId
            return (
              <li key={meta.id} className="drawer-item" aria-current={isActive || undefined}>
                {renaming === meta.id ? (
                  <input
                    className="drawer-rename"
                    defaultValue={meta.title}
                    autoFocus
                    aria-label="Document title"
                    onBlur={(event) => {
                      onRename(meta, event.target.value)
                      setRenaming(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                      if (event.key === 'Escape') setRenaming(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="drawer-open"
                    onClick={() => onOpenDocument(meta.id)}
                  >
                    <span className="drawer-name">{meta.title}</span>
                    <span className="drawer-meta">
                      {relativeTime(meta.updatedAt)} · {meta.words.toLocaleString()} words
                    </span>
                  </button>
                )}

                {confirming === meta.id ? (
                  <div className="drawer-confirm">
                    <span>Delete?</span>
                    <button
                      type="button"
                      className="ghost-btn drawer-danger"
                      onClick={() => {
                        onDelete(meta)
                        setConfirming(null)
                      }}
                    >
                      Delete
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => setConfirming(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="drawer-actions">
                    <button
                      type="button"
                      className="tool-btn"
                      aria-label={`Rename ${meta.title}`}
                      title="Rename"
                      onClick={() => setRenaming(meta.id)}
                    >
                      <PencilSimple size={15} weight="bold" />
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      aria-label={`Duplicate ${meta.title}`}
                      title="Duplicate"
                      onClick={() => onDuplicate(meta)}
                    >
                      <Files size={15} weight="bold" />
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      aria-label={`Delete ${meta.title}`}
                      title="Delete"
                      onClick={() => setConfirming(meta.id)}
                    >
                      <TrashSimple size={15} weight="bold" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </aside>
    </>
  )
}
