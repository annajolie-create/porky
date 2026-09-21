import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
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
 * Writing surfaces: headings, fonts, size, color, lists, quotes, undo/redo.
 * Plan section structure stays in paragraph/heading attrs, not in the outline chrome.
 */
export function buildExtensions(options: EditorOptions) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: false,
      code: false,
      horizontalRule: false,
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
    TextStyleKit.configure({
      backgroundColor: false,
      lineHeight: false,
    }),
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ParagraphIds.configure({ defaultSectionId: options.defaultSectionId }),
    Citation,
    SuggestionInsert,
    SuggestionDelete,
    SuggestionLock.configure({ lockedParagraphIds: options.lockedParagraphIds }),
    ParagraphDecorations,
    Spellcheck,
  ]
}
