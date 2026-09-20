import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { Printer } from '@phosphor-icons/react/dist/csr/Printer'
import { StatusBar } from './components/StatusBar'
import { buildExtensions } from './editor/extensions'
import { imageFilesFrom, insertImageFiles } from './editor/images'
import { Toolbar } from './toolbar/Toolbar'
import { DEFAULT_HTML, DEFAULT_TITLE, loadDoc, saveDoc } from './storage'

export default function App() {
  const saved = useMemo(() => loadDoc(), [])
  const [title, setTitle] = useState(saved?.title ?? DEFAULT_TITLE)
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [notice, setNotice] = useState<string | null>(null)

  // editorProps close over this rather than over `editor`, which does not
  // exist yet at the point useEditor is configured.
  const editorRef = useRef<Editor | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildExtensions(),
    content: saved?.html ?? DEFAULT_HTML,
    editorProps: {
      attributes: {
        class: 'page-body',
        'aria-label': 'Document',
        spellcheck: 'true',
      },
      handlePaste: (_view, event) => {
        const files = imageFilesFrom(event.clipboardData?.items ?? null)
        if (!files.length || !editorRef.current) return false
        // Screenshots arrive as both an image file and an HTML <img>, so
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

  editorRef.current = editor

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!editor) return
    let timer = 0
    const persist = () => {
      setSaveState('saving')
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        saveDoc({ version: 1, title, html: editor.getHTML() })
        setSaveState('saved')
      }, 400)
    }
    persist()
    editor.on('update', persist)
    return () => {
      editor.off('update', persist)
      window.clearTimeout(timer)
    }
  }, [editor, title])

  return (
    <div className="app">
      <header className="chrome">
        <div className="chrome-row">
          <div className="brand" aria-hidden="true">
            <span className="brand-mark" />
            <span className="brand-name">Porky</span>
          </div>
          <input
            className="title-input"
            value={title}
            aria-label="Document title"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (!title.trim()) setTitle(DEFAULT_TITLE)
            }}
          />
          <div className="chrome-meta">
            <span className="save-pill" aria-live="polite">
              {saveState === 'saving' ? 'Saving' : 'Saved'}
            </span>
            <button type="button" className="ghost-btn" onClick={() => window.print()}>
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
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <p className="page-loading">Opening document</p>
          )}
        </article>
      </main>

      <StatusBar editor={editor} notice={notice} />
    </div>
  )
}
