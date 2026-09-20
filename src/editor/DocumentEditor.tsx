import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { Files } from '@phosphor-icons/react/dist/csr/Files'
import { Printer } from '@phosphor-icons/react/dist/csr/Printer'
import { StatusBar } from '../components/StatusBar'
import type { DocumentBody, DocumentMeta } from '../storage/types'
import { Toolbar } from '../toolbar/Toolbar'
import { buildExtensions } from './extensions'
import { imageFilesFrom, insertImageFiles } from './images'
import { useAutosave } from './useAutosave'

type Props = {
  meta: DocumentMeta
  body: DocumentBody
  onSaved: (meta: DocumentMeta) => void
  onRename: (meta: DocumentMeta, title: string) => void
  onOpenDrawer: () => void
  registerFlush: (flush: () => Promise<void>) => void
}

export function DocumentEditor({
  meta,
  body,
  onSaved,
  onRename,
  onOpenDrawer,
  registerFlush,
}: Props) {
  const [title, setTitle] = useState(meta.title)
  const [notice, setNotice] = useState<string | null>(null)
  const editorRef = useRef<Editor | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildExtensions(),
    content: body.content,
    editorProps: {
      attributes: {
        class: 'page-body',
        'aria-label': 'Document',
        spellcheck: 'true',
      },
      handlePaste: (_view, event) => {
        const files = imageFilesFrom(event.clipboardData?.items ?? null)
        if (!files.length || !editorRef.current) return false
        // A screenshot arrives as both an image file and an HTML <img>, so
        // consuming the event here is what stops it being inserted twice.
        event.preventDefault()
        void insertImageFiles(editorRef.current, files).then(({ rejected }) => {
          if (rejected.length) setNotice(rejected[0])
        })
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        // An image dragged within the document is ProseMirror's business.
        if (moved) return false
        const files = imageFilesFrom(event.dataTransfer?.files ?? null)
        if (!files.length || !editorRef.current) return false
        event.preventDefault()
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        void insertImageFiles(editorRef.current, files, at).then(({ rejected }) => {
          if (rejected.length) setNotice(rejected[0])
        })
        return true
      },
    },
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  const { state: saveState, flush } = useAutosave({
    editor,
    meta: { ...meta, title },
    onSaved,
    onError: setNotice,
  })

  useEffect(() => {
    registerFlush(flush)
  }, [registerFlush, flush])

  // The browser's print dialog seeds the PDF filename from document.title.
  useEffect(() => {
    document.title = `${title.trim() || 'Untitled document'} — Porky`
  }, [title])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <>
      <header className="chrome">
        <div className="chrome-row">
          <button
            type="button"
            className="tool-btn"
            aria-label="Documents"
            title="Documents"
            onClick={onOpenDrawer}
          >
            <Files size={18} weight="bold" />
          </button>

          <input
            className="title-input"
            value={title}
            aria-label="Document title"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const next = title.trim() || 'Untitled document'
              if (next !== title) setTitle(next)
              if (next !== meta.title) onRename(meta, next)
            }}
          />

          <div className="chrome-meta">
            <span className="save-pill" aria-live="polite">
              {saveState === 'saving' ? 'Saving' : 'All changes saved'}
            </span>
            <button
              type="button"
              className="ghost-btn"
              title="Print or save as PDF (Ctrl or Cmd + P)"
              onClick={() => window.print()}
            >
              <Printer size={16} weight="bold" />
              Print
            </button>
          </div>
        </div>

        {editor ? (
          <Toolbar editor={editor} onNotice={setNotice} />
        ) : (
          <div className="toolbar toolbar-skeleton" />
        )}
      </header>

      <main
        className="desk"
        onMouseDown={(event) => {
          if (!editor) return
          if ((event.target as HTMLElement).closest('.page')) return
          editor.commands.focus('end')
        }}
      >
        <article className="page">
          {editor ? <EditorContent editor={editor} /> : <p className="page-loading">Opening document</p>}
        </article>
      </main>

      <StatusBar editor={editor} notice={notice} />
    </>
  )
}
