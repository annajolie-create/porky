import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import CharacterCount from '@tiptap/extension-character-count'
import { Printer } from '@phosphor-icons/react/dist/csr/Printer'
import { Toolbar } from './Toolbar'
import {
  DEFAULT_HTML,
  DEFAULT_TITLE,
  loadDoc,
  saveDoc,
} from './storage'

function wordLabel(count: number) {
  return count === 1 ? '1 word' : `${count.toLocaleString()} words`
}

export default function App() {
  const saved = useMemo(() => loadDoc(), [])
  const [title, setTitle] = useState(saved?.title ?? DEFAULT_TITLE)
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Type here. Enter starts a new paragraph.',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CharacterCount,
    ],
    content: saved?.html ?? DEFAULT_HTML,
    editorProps: {
      attributes: {
        class: 'page-body',
        'aria-label': 'Document',
        spellcheck: 'true',
      },
    },
  })

  const [, setSelection] = useState(0)
  useEffect(() => {
    if (!editor) return
    const bump = () => setSelection((n) => n + 1)
    editor.on('selectionUpdate', bump)
    editor.on('transaction', bump)
    return () => {
      editor.off('selectionUpdate', bump)
      editor.off('transaction', bump)
    }
  }, [editor])

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

  const words = editor?.storage.characterCount.words() ?? 0

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
            <button
              type="button"
              className="ghost-btn"
              onClick={() => window.print()}
            >
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

      <footer className="status">
        <span>{wordLabel(words)}</span>
      </footer>
    </div>
  )
}
