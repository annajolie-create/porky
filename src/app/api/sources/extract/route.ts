import { AIError, MODELS, chatJSON, jsonError } from '@/server/openrouter'
import { PROMPTS } from '@/server/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_PDF_BYTES = 15_000_000
const MAX_TEXT_CHARS = 400_000

type Extracted = {
  text: string
  title: string
  authors: string[]
  year: string
  snippet: string
  url?: string
  pages?: number
}

/**
 * Turns an uploaded PDF, a pasted link or raw text into plain text plus
 * best-effort metadata. multipart/form-data with `file`, or JSON with `url`
 * or `text`. Pass `meta=false` to skip the metadata model call.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    let text = ''
    let url: string | undefined
    let fallbackTitle = ''
    let pages: number | undefined
    let wantMeta = true

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      wantMeta = form.get('meta') !== 'false'
      if (!(file instanceof File)) return Response.json({ error: 'No file received.' }, { status: 400 })
      if (file.size > MAX_PDF_BYTES) return Response.json({ error: 'That file is over 15 MB. Use a shorter PDF.' }, { status: 413 })
      fallbackTitle = file.name.replace(/\.[a-z0-9]+$/i, '')
      const buffer = new Uint8Array(await file.arrayBuffer())
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const result = await extractPdf(buffer)
        text = result.text
        pages = result.pages
      } else {
        text = new TextDecoder().decode(buffer)
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as { url?: string; text?: string; meta?: boolean }
      wantMeta = body.meta !== false
      if (body.text) {
        text = body.text
      } else if (body.url) {
        url = normaliseUrl(body.url)
        const result = await extractLink(url)
        text = result.text
        fallbackTitle = result.title
      } else {
        return Response.json({ error: 'Send a file, a url or text.' }, { status: 400 })
      }
    }

    text = cleanText(text)
    if (!text) {
      return Response.json(
        { error: 'No readable text found. Scanned PDFs and image-only pages are not supported in this version.' },
        { status: 422 },
      )
    }
    if (text.length > MAX_TEXT_CHARS) text = `${text.slice(0, MAX_TEXT_CHARS)}\n[truncated]`

    let meta = { title: fallbackTitle, authors: [] as string[], year: '' }
    if (wantMeta && process.env.OPENROUTER_API_KEY) {
      try {
        meta = await extractMetadata(text, fallbackTitle, url)
      } catch {
        // Metadata is a nicety; the student can fill it in by hand.
      }
    }

    const extracted: Extracted = {
      text,
      title: meta.title || fallbackTitle || (url ?? 'Untitled source'),
      authors: meta.authors,
      year: meta.year,
      snippet: text.slice(0, 220).replace(/\s+/g, ' ').trim(),
      url,
      pages,
    }
    return Response.json(extracted)
  } catch (error) {
    return jsonError(error)
  }
}

async function extractPdf(buffer: Uint8Array): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(buffer)
  const { text, totalPages } = await extractText(pdf, { mergePages: true })
  return { text: Array.isArray(text) ? text.join('\n\n') : text, pages: totalPages }
}

async function extractLink(url: string): Promise<{ text: string; title: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EssayEditor/0.1; +https://essay.local)',
      Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new AIError(`Could not fetch that link (${response.status}).`, 422)
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('application/pdf')) {
    const result = await extractPdf(new Uint8Array(await response.arrayBuffer()))
    return { text: result.text, title: '' }
  }
  const html = await response.text()
  const { parseHTML } = await import('linkedom')
  const { Readability } = await import('@mozilla/readability')
  const { document } = parseHTML(html)
  const reader = new Readability(document as unknown as Document, { charThreshold: 200 })
  const article = reader.parse()
  const text = article?.textContent ?? document.body?.textContent ?? ''
  const title = article?.title ?? document.title ?? ''
  return { text, title }
}

async function extractMetadata(text: string, fallbackTitle: string, url?: string) {
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      authors: { type: 'array', items: { type: 'string' } },
      year: { type: 'string', description: 'Four-digit year or empty string' },
    },
    required: ['title', 'authors', 'year'],
    additionalProperties: false,
  }
  const result = await chatJSON<{ title: string; authors: string[]; year: string }>({
    model: MODELS.cheap,
    maxTokens: 400,
    jsonSchema: { name: 'metadata', schema },
    messages: [
      { role: 'system', content: PROMPTS.sourceMetadata },
      {
        role: 'user',
        content: `${url ? `URL: ${url}\n` : ''}${fallbackTitle ? `Filename or page title: ${fallbackTitle}\n` : ''}\nOpening text:\n"""\n${text.slice(0, 5000)}\n"""`,
      },
    ],
  })
  return {
    title: (result.title ?? '').trim(),
    authors: (result.authors ?? []).map((a) => String(a).trim()).filter(Boolean).slice(0, 8),
    year: String(result.year ?? '').match(/\d{4}/)?.[0] ?? '',
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim()
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return new URL(withProtocol).toString()
  } catch {
    throw new AIError('That does not look like a valid link.', 400)
  }
}
