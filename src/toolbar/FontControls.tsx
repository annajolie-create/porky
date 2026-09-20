import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import {
  DEFAULT_FONT,
  DEFAULT_FONT_SIZE,
  FONTS,
  FONT_SIZES,
  labelForStack,
  sizeFromMark,
} from '../editor/fonts'
import { Dropdown, MenuItem } from './primitives'

export function FontFamilyControl({ editor }: { editor: Editor }) {
  const label = useEditorState({
    editor,
    selector: ({ editor }) =>
      labelForStack(editor.getAttributes('textStyle').fontFamily as string | undefined),
  })

  return (
    <Dropdown
      label="Font"
      width={220}
      trigger={<span className="tool-label tool-label-wide">{label}</span>}
    >
      {(close) =>
        FONTS.map((font) => (
          <MenuItem
            key={font.label}
            active={font.label === label}
            style={{ fontFamily: font.stack }}
            onClick={() => {
              const chain = editor.chain().focus()
              // Leave the document default unmarked rather than writing the same
              // family onto every span of an otherwise untouched essay.
              if (font.label === DEFAULT_FONT.label) chain.unsetFontFamily().run()
              else chain.setFontFamily(font.stack).run()
              close()
            }}
          >
            {font.label}
          </MenuItem>
        ))
      }
    </Dropdown>
  )
}

export function FontSizeControl({ editor }: { editor: Editor }) {
  const current = useEditorState({
    editor,
    selector: ({ editor }) =>
      sizeFromMark(editor.getAttributes('textStyle').fontSize as string | undefined),
  })

  return (
    <Dropdown label="Font size" width={88} trigger={<span className="tool-label">{current}</span>}>
      {(close) =>
        FONT_SIZES.map((size) => (
          <MenuItem
            key={size}
            active={size === current}
            onClick={() => {
              const chain = editor.chain().focus()
              if (size === DEFAULT_FONT_SIZE) chain.unsetFontSize().run()
              else chain.setFontSize(`${size}pt`).run()
              close()
            }}
          >
            {size}
          </MenuItem>
        ))
      }
    </Dropdown>
  )
}
