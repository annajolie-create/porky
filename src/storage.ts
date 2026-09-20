export const STORAGE_KEY = 'porky-doc-v1'

export type SavedDoc = {
  version: 1
  title: string
  html: string
}

export const DEFAULT_TITLE = 'Untitled document'

export const DEFAULT_HTML = `<p>Start with a sentence, then keep going. Press Enter for a new paragraph.</p>
<p>Select a word and use the toolbar, or the usual shortcuts: <strong>bold</strong>, <em>italic</em>, and underline.</p>
<ul>
  <li>Bullet lists for notes that do not need an order</li>
  <li>Numbered lists when the sequence matters</li>
</ul>
<ol>
  <li>Write the argument</li>
  <li>Cut what you can live without</li>
  <li>Read it once more, then stop</li>
</ol>
<p></p>`

export function loadDoc(): SavedDoc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedDoc>
    if (parsed.version !== 1 || typeof parsed.html !== 'string') return null
    return {
      version: 1,
      title: typeof parsed.title === 'string' ? parsed.title : DEFAULT_TITLE,
      html: parsed.html,
    }
  } catch {
    return null
  }
}

export function saveDoc(doc: SavedDoc) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
}
