import type { Source } from './model'

/** "Jane Smith" -> { last: "Smith", initials: "J." } */
function splitName(name: string): { last: string; initials: string } {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (!clean) return { last: '', initials: '' }
  if (clean.includes(',')) {
    const [last, rest = ''] = clean.split(',').map((s) => s.trim())
    return { last, initials: initialsOf(rest) }
  }
  const parts = clean.split(' ')
  if (parts.length === 1) return { last: parts[0], initials: '' }
  const last = parts.pop() as string
  return { last, initials: initialsOf(parts.join(' ')) }
}

function initialsOf(given: string): string {
  return given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ')
}

function lastNames(source: Source): string[] {
  const names = source.authors.map((a) => splitName(a).last).filter(Boolean)
  if (names.length) return names
  // Fall back to a shortened title, as APA does for works without an author.
  const title = source.title.trim()
  return [title ? `"${title.split(' ').slice(0, 3).join(' ')}"` : 'Unknown']
}

function yearOf(source: Source): string {
  return source.year.trim() || 'n.d.'
}

/** In-text citation, e.g. (Smith, 2021), (Smith & Lee, 2021), (Smith et al., 2021). */
export function inTextCitation(source: Source): string {
  const names = lastNames(source)
  let who: string
  if (names.length === 1) who = names[0]
  else if (names.length === 2) who = `${names[0]} & ${names[1]}`
  else who = `${names[0]} et al.`
  return `(${who}, ${yearOf(source)})`
}

/** Reference-list entry in APA 7 style, best effort from what we know. */
export function referenceEntry(source: Source): string {
  const authors = source.authors.map(splitName).filter((a) => a.last)
  let authorPart: string
  if (!authors.length) authorPart = ''
  else if (authors.length === 1) authorPart = `${authors[0].last}${authors[0].initials ? `, ${authors[0].initials}` : ''}`
  else {
    const formatted = authors.map((a) => `${a.last}${a.initials ? `, ${a.initials}` : ''}`)
    const last = formatted.pop()
    authorPart = `${formatted.join(', ')}, & ${last}`
  }
  const title = source.title.trim() || 'Untitled'
  const year = yearOf(source)
  const url = source.url ? ` ${source.url}` : ''
  if (!authorPart) return `${title}. (${year}).${url}`.trim()
  return `${authorPart} (${year}). ${title}.${url}`.trim()
}

export function sortForReferenceList(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => referenceEntry(a).localeCompare(referenceEntry(b)))
}
