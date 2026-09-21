import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { Citation } from './citation'
import { ParagraphDecorations } from './decorations'
import { ParagraphIds } from './paragraphIds'
import { Spellcheck } from './spellcheck'
import { SuggestionDelete, SuggestionInsert, SuggestionLock } from './suggestions'

export type EditorOptions = {
  defaultSectionId: () => string | null
  lockedParagraphIds: () => Set<string>
}

/**
 * A deliberately small editor: bold, italic, underline, lists, block quotes,
 * undo/redo. No headings: section structure is invisible by design.
 */
export function buildExtensions(options: EditorOptions) {
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      code: false,
      horizontalRule: false,
      strike: false,
      link: false,
      dropcursor: false,
      gapcursor: false,
    }),
    Placeholder.configure({
      placeholder: 'Start writing, or ask the agent to draft a section from the plan.',
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
    }),
    CharacterCount,
    Underline,
    ParagraphIds.configure({ defaultSectionId: options.defaultSectionId }),
    Citation,
    SuggestionInsert,
    SuggestionDelete,
    SuggestionLock.configure({ lockedParagraphIds: options.lockedParagraphIds }),
    ParagraphDecorations,
    Spellcheck,
  ]
}
