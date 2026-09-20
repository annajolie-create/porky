import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { Highlighter } from '@phosphor-icons/react/dist/csr/Highlighter'
import { TextAa } from '@phosphor-icons/react/dist/csr/TextAa'
import { HIGHLIGHTS, PALETTE } from '../editor/colors'
import { Dropdown } from './primitives'

function Swatches({
  rows,
  current,
  onPick,
}: {
  rows: string[][]
  current?: string
  onPick: (color: string) => void
}) {
  return (
    <div className="swatch-grid">
      {rows.map((row, rowIndex) => (
        <div className="swatch-row" key={rowIndex}>
          {row.map((color) => (
            <button
              key={color}
              type="button"
              role="menuitemradio"
              aria-checked={color === current}
              className="swatch"
              style={{ background: color }}
              aria-label={color}
              title={color}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(color)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function TextColorControl({ editor }: { editor: Editor }) {
  const current = useEditorState({
    editor,
    selector: ({ editor }) => (editor.getAttributes('textStyle').color as string | undefined) ?? undefined,
  })

  return (
    <Dropdown
      label="Text colour"
      width={228}
      trigger={
        <span className="color-trigger">
          <TextAa size={18} weight="bold" />
          <span className="color-bar" style={{ background: current ?? '#1c2430' }} />
        </span>
      }
    >
      {(close) => (
        <>
          <button
            type="button"
            role="menuitem"
            className="menu-item menu-action"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetColor().run()
              close()
            }}
          >
            <span className="menu-icon">
              <span className="color-bar color-bar-auto" />
            </span>
            Automatic
          </button>
          <Swatches
            rows={PALETTE}
            current={current}
            onPick={(color) => {
              editor.chain().focus().setColor(color).run()
              close()
            }}
          />
        </>
      )}
    </Dropdown>
  )
}

export function HighlightControl({ editor }: { editor: Editor }) {
  const current = useEditorState({
    editor,
    selector: ({ editor }) =>
      (editor.getAttributes('textStyle').backgroundColor as string | undefined) ?? undefined,
  })

  return (
    <Dropdown
      label="Highlight colour"
      width={168}
      trigger={
        <span className="color-trigger">
          <Highlighter size={18} weight="bold" />
          <span className="color-bar" style={{ background: current ?? 'transparent' }} />
        </span>
      }
    >
      {(close) => (
        <>
          <button
            type="button"
            role="menuitem"
            className="menu-item menu-action"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetBackgroundColor().run()
              close()
            }}
          >
            <span className="menu-icon">
              <span className="color-bar color-bar-none" />
            </span>
            None
          </button>
          <Swatches
            rows={HIGHLIGHTS}
            current={current}
            onPick={(color) => {
              editor.chain().focus().setBackgroundColor(color).run()
              close()
            }}
          />
        </>
      )}
    </Dropdown>
  )
}
