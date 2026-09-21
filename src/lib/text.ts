export function countWords(text: string): number {
  const words = text.trim().match(/\S+/g)
  return words ? words.length : 0
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

export function firstLine(text: string, max = 90): string {
  return truncate(text, max)
}

/** Splits text into sentences without being clever about abbreviations. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'(\[])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Tokens for crude lexical overlap scoring. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüßéèàáíóúñç\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
}

const STOP = new Set(
  'the and for with that this from are was were has have had not but its into than then they them their there which what when where who whom will would could should also been being about over under more most some such only very can may might must shall does did doing our your his her she him you all any each other both few own same too out off yet nor per via'.split(
    ' ',
  ),
)
