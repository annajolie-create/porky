'use client'

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ArrowUUpLeft } from '@phosphor-icons/react/dist/csr/ArrowUUpLeft'
import { ArrowUUpRight } from '@phosphor-icons/react/dist/csr/ArrowUUpRight'
import { Highlighter } from '@phosphor-icons/react/dist/csr/Highlighter'
import { ListBullets } from '@phosphor-icons/react/dist/csr/ListBullets'
import { ListNumbers } from '@phosphor-icons/react/dist/csr/ListNumbers'
import { Quotes } from '@phosphor-icons/react/dist/csr/Quotes'
import { TextAlignCenter } from '@phosphor-icons/react/dist/csr/TextAlignCenter'
import { TextAlignJustify } from '@phosphor-icons/react/dist/csr/TextAlignJustify'
import { TextAlignLeft } from '@phosphor-icons/react/dist/csr/TextAlignLeft'
import { TextAlignRight } from '@phosphor-icons/react/dist/csr/TextAlignRight'
import { TextB } from '@phosphor-icons/react/dist/csr/TextB'
import { TextItalic } from '@phosphor-icons/react/dist/csr/TextItalic'
import { TextStrikethrough } from '@phosphor-icons/react/dist/csr/TextStrikethrough'
import { TextUnderline } from '@phosphor-icons/react/dist/csr/TextUnderline'
import { cx } from '../ui'
import { Menu, SwatchMenu } from '../Menu'
import type { MenuOption } from '../Menu'

const FONTS: MenuOption<string>[] = [
  { value: '', label: 'Newsreader', preview: true, style: { fontFamily: 'var(--font-display), Georgia, serif' } },
  { value: 'var(--font-ui), system-ui, sans-serif', label: 'Plus Jakarta', preview: true, style: { fontFamily: 'var(--font-ui), system-ui, sans-serif' } },
  { value: 'Georgia, serif', label: 'Georgia', preview: true, style: { fontFamily: 'Georgia, serif' } },
  { value: '"Times New Roman", Times, serif', label: 'Times', preview: true, style: { fontFamily: '"Times New Roman", Times, serif' } },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial', preview: true, style: { fontFamily: 'Arial, Helvetica, sans-serif' } },
  { value: '"Courier New", Courier, monospace', label: 'Courier', preview: true, style: { fontFamily: '"Courier New", Courier, monospace' } },
]

const SIZES: MenuOption<string>[] = [11, 12, 14, 16, 17, 18, 20, 22, 24, 28, 32, 36].map((n) => ({
  value: String(n),
  label: String(n),
}))

const BLOCKS: MenuOption<string>[] = [
  { value: 'p', label: 'Normal text', className: 'text-[13px]' },
  { value: 'title', label: 'Title', className: 'font-serif text-[19px] font-semibold tracking-[-0.03em]' },
  { value: 'h1', label: 'Heading 1', className: 'font-serif text-[16px] font-semibold tracking-[-0.02em]' },
  { value: 'h2', label: 'Heading 2', className: 'font-serif text-[14.5px] font-semibold' },
  { value: 'h3', label: 'Heading 3', className: 'text-[13px] font-semibold' },
]

const COLORS = [
  { value: '', label: 'Default', fill: '#ffffff' },
  { value: '#1a1916', label: 'Ink', fill: '#1a1916' },
  { value: '#a87a08', label: 'Gold', fill: '#a87a08' },
  { value: '#b42318', label: 'Red', fill: '#b42318' },
  { value: '#067647', label: 'Green', fill: '#067647' },
  { value: '#175cd3', label: 'Blue', fill: '#175cd3' },
  { value: '#8a877c', label: 'Muted', fill: '#8a877c' },
]

const HIGHLIGHTS = [
  { value: '', label: 'None', fill: '#ffffff' },
  { value: '#f4e7b3', label: 'Gold', fill: '#f4e7b3' },
  { value: '#fef3c7', label: 'Yellow', fill: '#fef3c7' },
  { value: '#dcf5e6', label: 'Green', fill: '#dcf5e6' },
  { value: '#fde8e6', label: 'Pink', fill: '#fde8e6' },
]

function currentBlock(editor: Editor): string {
  if (editor.isActive('heading', { level: 1 })) return 'title'
  if (editor.isActive('heading', { level: 2 })) return 'h1'
  if (editor.isActive('heading', { level: 3 })) return 'h2'
  if (editor.isActive('heading', { level: 4 })) return 'h3'
  return 'p'
}

function applyBlock(editor: Editor, style: string) {
  const chain = editor.chain().focus()
  if (style === 'p') chain.setParagraph().run()
  else if (style === 'title') chain.setHeading({ level: 1 }).run()
  else if (style === 'h1') chain.setHeading({ level: 2 }).run()
  else if (style === 'h2') chain.setHeading({ level: 3 }).run()
  else chain.setHeading({ level: 4 }).run()
}

export function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    const rerender = () => force((n) => n + 1)
    editor.on('transaction', rerender)
    return () => {
      editor.off('transaction', rerender)
    }
  }, [editor])

  const font = (editor.getAttributes('textStyle').fontFamily as string | undefined) ?? ''
  const sizeRaw = editor.getAttributes('textStyle').fontSize as string | undefined
  const size = sizeRaw ? String(parseInt(sizeRaw, 10)) : '17'
  const color = (editor.getAttributes('textStyle').color as string | undefined) ?? ''
  const highlight = (editor.getAttributes('highlight').color as string | undefined) ?? ''
  const align = editor.isActive({ textAlign: 'center' })
    ? 'center'
    : editor.isActive({ textAlign: 'right' })
      ? 'right'
      : editor.isActive({ textAlign: 'justify' })
        ? 'justify'
        : 'left'

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
        'size-7 grid place-items-center rounded-md transition-colors disabled:opacity-30 active:scale-[0.97]',
        active ? 'bg-accent-soft text-gold-ink' : 'text-ink-soft hover:bg-black/5',
      )}
    >
      {icon}
    </button>
  )

  return (
    <div className="no-print shrink-0 h-11 bg-surface border-b border-line flex items-center gap-0.5 px-3 overflow-x-auto">
      {item('Undo', false, () => editor.chain().focus().undo().run(), <ArrowUUpLeft size={15} />, !editor.can().undo())}
      {item('Redo', false, () => editor.chain().focus().redo().run(), <ArrowUUpRight size={15} />, !editor.can().redo())}
      <Sep />
      <Menu
        id="block"
        openId={openId}
        onOpen={setOpenId}
        label="Block style"
        value={currentBlock(editor)}
        options={BLOCKS}
        onChange={(style) => applyBlock(editor, style)}
      />
      <Menu
        id="font"
        openId={openId}
        onOpen={setOpenId}
        label="Font"
        value={FONTS.some((f) => f.value === font) ? font : ''}
        options={FONTS}
        onChange={(value) => {
          if (!value) editor.chain().focus().unsetFontFamily().run()
          else editor.chain().focus().setFontFamily(value).run()
        }}
      />
      <Menu
        id="size"
        openId={openId}
        onOpen={setOpenId}
        label="Font size"
        value={SIZES.some((s) => s.value === size) ? size : '17'}
        options={SIZES}
        compact
        layout="grid"
        onChange={(n) => {
          if (n === '17') editor.chain().focus().unsetFontSize().run()
          else editor.chain().focus().setFontSize(`${n}px`).run()
        }}
      />
      <Sep />
      {item('Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <TextB size={15} weight="bold" />)}
      {item('Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <TextItalic size={15} />)}
      {item('Underline', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <TextUnderline size={15} />)}
      {item('Strikethrough', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <TextStrikethrough size={15} />)}
      <Sep />
      <SwatchMenu
        id="color"
        openId={openId}
        onOpen={setOpenId}
        label="Text colour"
        value={color}
        swatches={COLORS}
        onChange={(value) => {
          if (!value) editor.chain().focus().unsetColor().run()
          else editor.chain().focus().setColor(value).run()
        }}
        trigger={
          <span className="flex flex-col items-center gap-[3px]">
            <span className="text-[12px] font-semibold leading-none" style={{ color: color || undefined }}>
              A
            </span>
            <span className="h-[2px] w-3 rounded-full" style={{ background: color || '#1a1916' }} />
          </span>
        }
      />
      <SwatchMenu
        id="highlight"
        openId={openId}
        onOpen={setOpenId}
        label="Highlight"
        value={highlight}
        swatches={HIGHLIGHTS}
        onChange={(value) => {
          if (!value) editor.chain().focus().unsetHighlight().run()
          else editor.chain().focus().setHighlight({ color: value }).run()
        }}
        trigger={<Highlighter size={15} />}
      />
      <Sep />
      {item('Align left', align === 'left', () => editor.chain().focus().setTextAlign('left').run(), <TextAlignLeft size={15} />)}
      {item('Align center', align === 'center', () => editor.chain().focus().setTextAlign('center').run(), <TextAlignCenter size={15} />)}
      {item('Align right', align === 'right', () => editor.chain().focus().setTextAlign('right').run(), <TextAlignRight size={15} />)}
      {item('Justify', align === 'justify', () => editor.chain().focus().setTextAlign('justify').run(), <TextAlignJustify size={15} />)}
      <Sep />
      {item('Bullet list', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <ListBullets size={15} />)}
      {item('Numbered list', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListNumbers size={15} />)}
      {item('Block quote', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quotes size={15} />)}
    </div>
  )
}

function Sep() {
  return <span className="w-px h-5 bg-line mx-1 shrink-0" />
}
