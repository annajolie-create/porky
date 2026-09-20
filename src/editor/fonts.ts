export type FontOption = {
  label: string
  /** Written verbatim into the font-family mark, so it must be a full stack. */
  stack: string
}

export const FONTS: FontOption[] = [
  { label: 'Source Serif', stack: "'Source Serif 4', Georgia, serif" },
  { label: 'EB Garamond', stack: "'EB Garamond', Garamond, serif" },
  { label: 'Lora', stack: "'Lora', Georgia, serif" },
  { label: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
  { label: 'IBM Plex Sans', stack: "'IBM Plex Sans', 'Segoe UI', sans-serif" },
  { label: 'Inter', stack: "'Inter', 'Segoe UI', sans-serif" },
  { label: 'Arial', stack: "Arial, Helvetica, sans-serif" },
  { label: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, monospace" },
  { label: 'Courier New', stack: "'Courier New', Courier, monospace" },
]

export const DEFAULT_FONT = FONTS[0]

/** Points, the unit a word processor shows. Rendered as `font-size: 12pt`. */
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72]

export const DEFAULT_FONT_SIZE = 12

export function labelForStack(stack: string | undefined) {
  if (!stack) return DEFAULT_FONT.label
  const match = FONTS.find((font) => font.stack === stack)
  if (match) return match.label
  // A pasted document can carry a family we do not offer; show its first name.
  return stack.split(',')[0].replace(/['"]/g, '').trim() || DEFAULT_FONT.label
}

export function sizeFromMark(fontSize: string | undefined) {
  if (!fontSize) return DEFAULT_FONT_SIZE
  const parsed = parseFloat(fontSize)
  return Number.isFinite(parsed) ? Math.round(parsed) : DEFAULT_FONT_SIZE
}
