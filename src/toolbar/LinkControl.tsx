import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { Link as LinkIcon } from '@phosphor-icons/react/dist/csr/Link'
import { LinkBreak } from '@phosphor-icons/react/dist/csr/LinkBreak'

/** Bare input like "example.com" is a URL the writer meant, not a typo. */
function normalise(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('#')) return trimmed
  return `https://${trimmed}`
}

export function LinkControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      active: editor.isActive('link'),
      href: (editor.getAttributes('link').href as string | undefined) ?? '',
    }),
  })

  const start = useCallback(() => {
    setValue((editor.getAttributes('link').href as string | undefined) ?? '')
    setOpen(true)
  }, [editor])

  // Cmd/Ctrl+K is bound here rather than in an extension so the extension does
  // not need a callback threaded into it from React.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      if (!editor.isFocused && !root.current?.contains(document.activeElement)) return
      event.preventDefault()
      start()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editor, start])

  useEffect(() => {
    if (!open) return
    field.current?.focus()
    field.current?.select()

    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const apply = () => {
    const href = normalise(value)
    const chain = editor.chain().focus().extendMarkRange('link')
    // ProseMirror keeps its selection while the input holds DOM focus, so
    // focus() lands back on exactly the range the writer had selected.
    if (href) chain.setLink({ href }).run()
    else chain.unsetLink().run()
    setOpen(false)
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setOpen(false)
  }

  return (
    <div className="tool-menu" ref={root}>
      <button
        type="button"
        className="tool-btn"
        aria-label="Link (Ctrl or Cmd + K)"
        title="Link (Ctrl or Cmd + K)"
        aria-pressed={state.active}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={start}
      >
        <LinkIcon size={18} weight="bold" />
      </button>

      {open ? (
        <div className="tool-pop tool-pop-start link-pop" role="dialog" aria-label="Link">
          <input
            ref={field}
            className="link-field"
            type="text"
            placeholder="Paste or type a link"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                apply()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
                editor.commands.focus()
              }
            }}
          />
          <div className="link-actions">
            <button type="button" className="ghost-btn" onMouseDown={(e) => e.preventDefault()} onClick={apply}>
              Apply
            </button>
            {state.active ? (
              <>
                <button
                  type="button"
                  className="tool-btn"
                  aria-label="Remove link"
                  title="Remove link"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={remove}
                >
                  <LinkBreak size={16} weight="bold" />
                </button>
                <button
                  type="button"
                  className="tool-btn"
                  aria-label="Open link in a new tab"
                  title="Open link in a new tab"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => window.open(state.href, '_blank', 'noopener,noreferrer')}
                >
                  <ArrowSquareOut size={16} weight="bold" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
