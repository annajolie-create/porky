import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageView } from './ImageView'

/**
 * Width is a percentage of the text column, not a pixel count, so an image
 * keeps its proportions across the mobile breakpoint, the A4 print page and
 * any future page size.
 */
export const ImageNode = Image.extend({
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element) => element.getAttribute('data-width') ?? '100%',
        renderHTML: (attributes) => ({ 'data-width': attributes.width }),
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') ?? 'center',
        renderHTML: (attributes) => ({ 'data-align': attributes.align }),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
}).configure({
  inline: false,
  // Without this the parse rule is img[src]:not([src^="data:"]) and every
  // embedded image would be silently dropped on load.
  allowBase64: true,
  // The built-in resizer only reads width in its constructor, so width presets
  // would not take effect. The node view above owns resizing instead.
  resize: false,
})
