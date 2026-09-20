import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Printer } from '@phosphor-icons/react/dist/csr/Printer'
import { StatusBar } from './components/StatusBar'
import { buildExtensions } from './editor/extensions'
import { Toolbar } from './toolbar/Toolbar'
import { DEFAULT_HTML, DEFAULT_TITLE, loadDoc, saveDoc } from './storage'

export default function App() {
  const saved = useMemo(() => loadDoc(), [])
  const [title, setTitle] = useState(saved?.title ?? DEFAULT_TITLE)
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')

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
    },
  })

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
        {editor ? <Toolbar editor={editor} /> : <div className="toolbar toolbar-skeleton" />}
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

      <StatusBar editor={editor} />
    </div>
  )
}
