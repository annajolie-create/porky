import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise'
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise'
import { Code } from '@phosphor-icons/react/dist/csr/Code'
import { CodeBlock } from '@phosphor-icons/react/dist/csr/CodeBlock'
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree'
import { Eraser } from '@phosphor-icons/react/dist/csr/Eraser'
import { ListBullets } from '@phosphor-icons/react/dist/csr/ListBullets'
import { ListNumbers } from '@phosphor-icons/react/dist/csr/ListNumbers'
import { Minus } from '@phosphor-icons/react/dist/csr/Minus'
import { Quotes } from '@phosphor-icons/react/dist/csr/Quotes'
import { TextB } from '@phosphor-icons/react/dist/csr/TextB'
import { TextIndent } from '@phosphor-icons/react/dist/csr/TextIndent'
import { TextItalic } from '@phosphor-icons/react/dist/csr/TextItalic'
import { TextOutdent } from '@phosphor-icons/react/dist/csr/TextOutdent'
import { TextStrikethrough } from '@phosphor-icons/react/dist/csr/TextStrikethrough'
import { TextSubscript } from '@phosphor-icons/react/dist/csr/TextSubscript'
import { TextSuperscript } from '@phosphor-icons/react/dist/csr/TextSuperscript'
import { TextUnderline } from '@phosphor-icons/react/dist/csr/TextUnderline'
import { BlockStyleSelect } from './BlockStyleSelect'
import { HighlightControl, TextColorControl } from './ColorControls'
import { FontFamilyControl, FontSizeControl } from './FontControls'
import { LinkControl } from './LinkControl'
import { AlignControl, LineSpacingControl } from './ParagraphControls'
import { Divider, Dropdown, MenuAction, ToolButton } from './primitives'

/** Below this the paragraph group folds into the overflow menu too. */
const NARROW = 900

function useIsNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < NARROW,
  )
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return narrow
}

export function Toolbar({ editor }: { editor: Editor }) {
  const narrow = useIsNarrow()
  const marks = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      code: editor.isActive('code'),
      codeBlock: editor.isActive('codeBlock'),
      subscript: editor.isActive('subscript'),
      superscript: editor.isActive('superscript'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  })

  const paragraphGroup = (
    <>
      <AlignControl editor={editor} />
      <ToolButton
        label="Bulleted list"
        pressed={marks.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListBullets size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        pressed={marks.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListNumbers size={18} weight="bold" />
      </ToolButton>
      <ToolButton label="Decrease indent" onClick={() => editor.chain().focus().outdent().run()}>
        <TextOutdent size={18} weight="bold" />
      </ToolButton>
      <ToolButton label="Increase indent" onClick={() => editor.chain().focus().indent().run()}>
        <TextIndent size={18} weight="bold" />
      </ToolButton>
      <LineSpacingControl editor={editor} />
    </>
  )

  return (
    <div className="toolbar" role="toolbar" aria-label="Text formatting">
      <ToolButton
        label="Undo (Ctrl or Cmd + Z)"
        disabled={!marks.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <ArrowCounterClockwise size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Redo (Ctrl or Cmd + Shift + Z)"
        disabled={!marks.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <ArrowClockwise size={18} weight="bold" />
      </ToolButton>

      <Divider />
      <BlockStyleSelect editor={editor} />
      <FontFamilyControl editor={editor} />
      <FontSizeControl editor={editor} />

      <Divider />
      <ToolButton
        label="Bold (Ctrl or Cmd + B)"
        pressed={marks.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <TextB size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Italic (Ctrl or Cmd + I)"
        pressed={marks.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <TextItalic size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Underline (Ctrl or Cmd + U)"
        pressed={marks.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <TextUnderline size={18} weight="bold" />
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        pressed={marks.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <TextStrikethrough size={18} weight="bold" />
      </ToolButton>

      <Divider />
      <TextColorControl editor={editor} />
      <HighlightControl editor={editor} />

      <Divider />
      <LinkControl editor={editor} />

      {narrow ? null : (
        <>
          <Divider />
          {paragraphGroup}
        </>
      )}

      <Divider />
      <Dropdown label="More formatting" width={216} align="end" trigger={<DotsThree size={18} weight="bold" />}>
        {(close) => (
          <>
            {narrow ? <div className="menu-row">{paragraphGroup}</div> : null}
            <MenuAction
              active={marks.blockquote}
              icon={<Quotes size={16} weight="bold" />}
              onClick={() => {
                editor.chain().focus().toggleBlockquote().run()
                close()
              }}
            >
              Quote
            </MenuAction>
            <MenuAction
              active={marks.code}
              icon={<Code size={16} weight="bold" />}
              onClick={() => {
                editor.chain().focus().toggleCode().run()
                close()
              }}
            >
              Inline code
            </MenuAction>
            <MenuAction
              active={marks.codeBlock}
              icon={<CodeBlock size={16} weight="bold" />}
              onClick={() => {
                editor.chain().focus().toggleCodeBlock().run()
                close()
              }}
            >
              Code block
            </MenuAction>
            <MenuAction
              active={marks.superscript}
              icon={<TextSuperscript size={16} weight="bold" />}
              onClick={() => {
                editor.chain().focus().toggleSuperscript().run()
                close()
              }}
            >
              Superscript
            </MenuAction>
            <MenuAction
              active={marks.subscript}
              icon={<TextSubscript size={16} weight="bold" />}
              onClick={() => {
                editor.chain().focus().toggleSubscript().run()
                close()
              }}
            >
              Subscript
            </MenuAction>
            <MenuAction
              icon={<Minus size={16} weight="bold" />}
              onClick={() => {
                editor.chain().focus().setHorizontalRule().run()
                close()
              }}
            >
              Horizontal rule
            </MenuAction>
            <MenuAction
              icon={<Eraser size={16} weight="bold" />}
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .unsetAllMarks()
                  .clearNodes()
                  .unsetTextAlign()
                  .unsetBlockLineHeight()
                  .run()
                close()
              }}
            >
              Clear formatting
            </MenuAction>
          </>
        )}
      </Dropdown>
    </div>
  )
}
