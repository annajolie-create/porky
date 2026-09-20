import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'

function wordLabel(count: number) {
  return count === 1 ? '1 word' : `${count.toLocaleString()} words`
}

export function StatusBar({ editor }: { editor: Editor | null }) {
  return (
    <footer className="status">
      {editor ? <Counts editor={editor} /> : <span>&nbsp;</span>}
    </footer>
  )
}

function Counts({ editor }: { editor: Editor }) {
  const counts = useEditorState({
    editor,
    selector: ({ editor }) => ({
      words: editor.storage.characterCount.words() as number,
      characters: editor.storage.characterCount.characters() as number,
    }),
  })

  return (
    <span>
      {wordLabel(counts.words)} · {counts.characters.toLocaleString()} characters
    </span>
  )
}
