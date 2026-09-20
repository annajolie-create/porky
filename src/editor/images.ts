import type { Editor } from '@tiptap/react'

/**
 * Images are embedded as data URLs so a document stays self-contained: it
 * prints, duplicates and copies between documents with nothing to resolve.
 * Base64 costs about 33% over the raw bytes, which is affordable only because
 * everything is downscaled on the way in — and why documents live in
 * IndexedDB rather than localStorage.
 *
 * The alternative, if illustrated documents ever become the norm: keep blobs
 * in their own object store keyed by hash and put `porky-img:<hash>` in the
 * src, resolving to object URLs on load. That drops the base64 tax and
 * deduplicates repeats, at the cost of self-containment.
 */

const MAX_EDGE = 1600
const QUALITY = 0.85
/** Below this a file is already small enough that re-encoding only loses quality. */
const PASS_THROUGH_BYTES = 256 * 1024
const HARD_CAP_BYTES = 12 * 1024 * 1024

export const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'))
    reader.readAsDataURL(blob)
  })
}

async function toDataUrl(file: File): Promise<string> {
  // Canvas re-encoding flattens an animated GIF to its first frame, and SVG is
  // already tiny vector text. Both go through untouched.
  const isVectorOrAnimated = file.type === 'image/gif' || file.type === 'image/svg+xml'
  if (isVectorOrAnimated || file.size <= PASS_THROUGH_BYTES) return readAsDataUrl(file)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return readAsDataUrl(file)
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= PASS_THROUGH_BYTES) {
    bitmap.close()
    return readAsDataUrl(file)
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return readAsDataUrl(file)
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // WebP keeps alpha, so screenshots and logos with transparency survive.
  const encoded = canvas.toDataURL('image/webp', QUALITY)
  const original = await readAsDataUrl(file)
  return encoded.length < original.length ? encoded : original
}

export type ImportResult = { inserted: number; rejected: string[] }

export async function insertImageFiles(
  editor: Editor,
  files: Iterable<File>,
  at?: number,
): Promise<ImportResult> {
  const rejected: string[] = []
  let inserted = 0
  let position = at

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      rejected.push(`${file.name || 'That file'} is not an image`)
      continue
    }
    if (file.size > HARD_CAP_BYTES) {
      rejected.push(`${file.name || 'That image'} is larger than 12 MB`)
      continue
    }

    try {
      const src = await toDataUrl(file)
      const chain = editor.chain().focus()
      if (position === undefined) chain.setImage({ src, alt: file.name })
      else chain.insertContentAt(position, { type: 'image', attrs: { src, alt: file.name } })
      chain.run()
      // Subsequent files in one drop go after the previous one rather than
      // all landing on the same position in reverse order.
      position = undefined
      inserted += 1
    } catch {
      rejected.push(`${file.name || 'That image'} could not be read`)
    }
  }

  return { inserted, rejected }
}

export function imageFilesFrom(list: FileList | DataTransferItemList | null): File[] {
  if (!list) return []
  const files: File[] = []
  for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = 'getAsFile' in entry ? entry.getAsFile() : entry
    if (file && file.type.startsWith('image/')) files.push(file)
  }
  return files
}
