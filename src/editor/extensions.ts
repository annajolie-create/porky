import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { BlockAttributes } from './blockAttributes'

/**
 * StarterKit 3.x already bundles bold, italic, underline, strike, code,
 * codeBlock, blockquote, horizontalRule, the lists and link, so none of those
 * are registered again here. Registering one twice is a runtime warning and a
 * duplicate keymap.
 */
export function buildExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        // Link opens on click even while editable, so a plain click inside a
        // link would navigate away from the document being written.
        openOnClick: false,
        enableClickSelection: true,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      },
    }),

    // lineHeight is disabled: BlockAttributes owns it as a block property.
    TextStyleKit.configure({ lineHeight: false }),

    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    BlockAttributes,

    Placeholder.configure({
      placeholder: 'Type here. Enter starts a new paragraph.',
    }),
    CharacterCount,
  ]
}
