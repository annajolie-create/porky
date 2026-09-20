import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { ArrowsOutLineVertical } from '@phosphor-icons/react/dist/csr/ArrowsOutLineVertical'
import { TextAlignCenter } from '@phosphor-icons/react/dist/csr/TextAlignCenter'
import { TextAlignJustify } from '@phosphor-icons/react/dist/csr/TextAlignJustify'
import { TextAlignLeft } from '@phosphor-icons/react/dist/csr/TextAlignLeft'
import { TextAlignRight } from '@phosphor-icons/react/dist/csr/TextAlignRight'
import { DEFAULT_LINE_HEIGHT, LINE_HEIGHTS } from '../editor/blockAttributes'
import { Dropdown, MenuAction, MenuItem } from './primitives'

const ALIGNMENTS = [
  { id: 'left', label: 'Align left', Icon: TextAlignLeft },
  { id: 'center', label: 'Centre', Icon: TextAlignCenter },
  { id: 'right', label: 'Align right', Icon: TextAlignRight },
  { id: 'justify', label: 'Justify', Icon: TextAlignJustify },
] as const

export function AlignControl({ editor }: { editor: Editor }) {
  const activeId = useEditorState({
    editor,
    selector: ({ editor }) =>
      ALIGNMENTS.find((option) => editor.isActive({ textAlign: option.id }))?.id ?? 'left',
  })
  const active = ALIGNMENTS.find((option) => option.id === activeId) ?? ALIGNMENTS[0]
  const ActiveIcon = active.Icon

  return (
    <Dropdown label="Alignment" width={168} trigger={<ActiveIcon size={18} weight="bold" />}>
      {(close) =>
        ALIGNMENTS.map(({ id, label, Icon }) => (
          <MenuAction
            key={id}
            active={id === active.id}
            icon={<Icon size={16} weight="bold" />}
            onClick={() => {
              editor.chain().focus().setTextAlign(id).run()
              close()
            }}
          >
            {label}
          </MenuAction>
        ))
      }
    </Dropdown>
  )
}

function activeLineHeight(editor: Editor) {
  const fromHeading = editor.getAttributes('heading').lineHeight as string | undefined
  const fromParagraph = editor.getAttributes('paragraph').lineHeight as string | undefined
  return fromParagraph ?? fromHeading ?? DEFAULT_LINE_HEIGHT
}

export function LineSpacingControl({ editor }: { editor: Editor }) {
  const active = useEditorState({ editor, selector: ({ editor }) => activeLineHeight(editor) })

  return (
    <Dropdown
      label="Line spacing"
      width={148}
      trigger={<ArrowsOutLineVertical size={18} weight="bold" />}
    >
      {(close) =>
        LINE_HEIGHTS.map((value) => (
          <MenuItem
            key={value}
            active={value === active}
            onClick={() => {
              const chain = editor.chain().focus()
              if (value === DEFAULT_LINE_HEIGHT) chain.unsetBlockLineHeight().run()
              else chain.setBlockLineHeight(value).run()
              close()
            }}
          >
            {value === DEFAULT_LINE_HEIGHT ? `${value}  (default)` : value}
          </MenuItem>
        ))
      }
    </Dropdown>
  )
}
