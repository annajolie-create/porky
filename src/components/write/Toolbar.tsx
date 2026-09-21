'use client'

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ArrowUUpLeft } from '@phosphor-icons/react/dist/csr/ArrowUUpLeft'
import { ArrowUUpRight } from '@phosphor-icons/react/dist/csr/ArrowUUpRight'
import { ListBullets } from '@phosphor-icons/react/dist/csr/ListBullets'
import { ListNumbers } from '@phosphor-icons/react/dist/csr/ListNumbers'
import { Quotes } from '@phosphor-icons/react/dist/csr/Quotes'
import { TextB } from '@phosphor-icons/react/dist/csr/TextB'
import { TextItalic } from '@phosphor-icons/react/dist/csr/TextItalic'
import { TextUnderline } from '@phosphor-icons/react/dist/csr/TextUnderline'
import { cx } from '../ui'

export function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = useState(0)

  useEffect(() => {
    const rerender = () => force((n) => n + 1)
    editor.on('transaction', rerender)
    return () => {
      editor.off('transaction', rerender)
    }
  }, [editor])

  const item = (label: string, active: boolean, onClick: () => void, icon: React.ReactNode, disabled = false) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        'size-7 grid place-items-center rounded transition-colors disabled:opacity-30',
        active ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-black/5',
      )}
    >
      {icon}
    </button>
  )

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface/95 backdrop-blur px-1 py-0.5 shadow-soft">
      {item('Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <TextB size={15} weight="bold" />)}
      {item('Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <TextItalic size={15} />)}
      {item('Underline', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <TextUnderline size={15} />)}
      <span className="w-px h-4 bg-line mx-1" />
      {item('Bullet list', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <ListBullets size={15} />)}
      {item('Numbered list', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListNumbers size={15} />)}
      {item('Block quote', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quotes size={15} />)}
      <span className="w-px h-4 bg-line mx-1" />
      {item('Undo', false, () => editor.chain().focus().undo().run(), <ArrowUUpLeft size={15} />, !editor.can().undo())}
      {item('Redo', false, () => editor.chain().focus().redo().run(), <ArrowUUpRight size={15} />, !editor.can().redo())}
    </div>
  )
}
