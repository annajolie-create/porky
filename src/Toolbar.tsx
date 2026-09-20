import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise'
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise'
import { ListBullets } from '@phosphor-icons/react/dist/csr/ListBullets'
import { ListNumbers } from '@phosphor-icons/react/dist/csr/ListNumbers'
import { TextAlignCenter } from '@phosphor-icons/react/dist/csr/TextAlignCenter'
import { TextAlignLeft } from '@phosphor-icons/react/dist/csr/TextAlignLeft'
import { TextAlignRight } from '@phosphor-icons/react/dist/csr/TextAlignRight'
import { TextB } from '@phosphor-icons/react/dist/csr/TextB'
import { TextItalic } from '@phosphor-icons/react/dist/csr/TextItalic'
import { TextUnderline } from '@phosphor-icons/react/dist/csr/TextUnderline'
import { TextT } from '@phosphor-icons/react/dist/csr/TextT'

type ToolbarProps = {
  editor: Editor
}

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="tool-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="tool-divider" role="separator" />
}

export function Toolbar({ editor }: ToolbarProps) {
  const block =
    editor.isActive('heading', { level: 1 })
      ? 'h1'
      : editor.isActive('heading', { level: 2 })
        ? 'h2'
        : editor.isActive('heading', { level: 3 })
          ? 'h3'
          : 'p'

  return (
    <div className="toolbar" role="toolbar" aria-label="Text formatting">
      <ToolButton
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <ArrowCounterClockwise size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <ArrowClockwise size={18} weight="bold" />
      </ToolButton>

      <Divider />

      <label className="block-select">
        <span className="sr-only">Paragraph style</span>
        <TextT size={16} weight="bold" />
        <select
          value={block}
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const value = event.target.value
            const chain = editor.chain().focus()
            if (value === 'p') chain.setParagraph().run()
            if (value === 'h1') chain.toggleHeading({ level: 1 }).run()
            if (value === 'h2') chain.toggleHeading({ level: 2 }).run()
            if (value === 'h3') chain.toggleHeading({ level: 3 }).run()
          }}
        >
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
      </label>

      <Divider />

      <ToolButton
        label="Bold (Ctrl or Cmd + B)"
        pressed={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <TextB size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Italic (Ctrl or Cmd + I)"
        pressed={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <TextItalic size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Underline (Ctrl or Cmd + U)"
        pressed={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <TextUnderline size={18} weight="bold" />
      </ToolButton>

      <Divider />

      <ToolButton
        label="Bulleted list"
        pressed={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListBullets size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        pressed={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListNumbers size={18} weight="bold" />
      </ToolButton>

      <Divider />

      <ToolButton
        label="Align left"
        pressed={
          editor.isActive({ textAlign: 'left' }) ||
          (!editor.isActive({ textAlign: 'center' }) &&
            !editor.isActive({ textAlign: 'right' }))
        }
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <TextAlignLeft size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Align center"
        pressed={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <TextAlignCenter size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Align right"
        pressed={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <TextAlignRight size={18} weight="bold" />
      </ToolButton>
    </div>
  )
}
