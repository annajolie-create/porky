import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { Dropdown, MenuItem } from './primitives'

const BLOCKS = [
  { id: 'p', label: 'Normal text', className: 'preview-p' },
  { id: 'h1', label: 'Heading 1', className: 'preview-h1' },
  { id: 'h2', label: 'Heading 2', className: 'preview-h2' },
  { id: 'h3', label: 'Heading 3', className: 'preview-h3' },
] as const

type BlockId = (typeof BLOCKS)[number]['id']

function activeBlock(editor: Editor): BlockId {
  if (editor.isActive('heading', { level: 1 })) return 'h1'
  if (editor.isActive('heading', { level: 2 })) return 'h2'
  if (editor.isActive('heading', { level: 3 })) return 'h3'
  return 'p'
}

export function BlockStyleSelect({ editor }: { editor: Editor }) {
  const active = useEditorState({ editor, selector: ({ editor }) => activeBlock(editor) })
  const label = BLOCKS.find((block) => block.id === active)?.label ?? 'Normal text'

  return (
    <Dropdown
      label="Paragraph style"
      width={196}
      trigger={<span className="tool-label tool-label-wide">{label}</span>}
    >
      {(close) =>
        BLOCKS.map((block) => (
          <MenuItem
            key={block.id}
            active={block.id === active}
            onClick={() => {
              const chain = editor.chain().focus()
              if (block.id === 'p') chain.setParagraph().run()
              else chain.setHeading({ level: Number(block.id.slice(1)) as 1 | 2 | 3 }).run()
              close()
            }}
          >
            <span className={block.className}>{block.label}</span>
          </MenuItem>
        ))
      }
    </Dropdown>
  )
}
