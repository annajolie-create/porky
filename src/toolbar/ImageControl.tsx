import { useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { ImageSquare } from '@phosphor-icons/react/dist/csr/ImageSquare'
import { ACCEPTED_TYPES, insertImageFiles } from '../editor/images'
import { ToolButton } from './primitives'

export function ImageControl({
  editor,
  onNotice,
}: {
  editor: Editor
  onNotice: (message: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <>
      <ToolButton label="Insert image" onClick={() => input.current?.click()}>
        <ImageSquare size={18} weight="bold" />
      </ToolButton>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        tabIndex={-1}
        onChange={async (event) => {
          const files = event.target.files
          if (!files?.length) return
          const result = await insertImageFiles(editor, Array.from(files))
          if (result.rejected.length) onNotice(result.rejected[0])
          // Without this, picking the same file twice in a row does nothing.
          event.target.value = ''
        }}
      />
    </>
  )
}
