import { generateJSON } from '@tiptap/core'
import type { JSONContent } from '@tiptap/react'
import { buildExtensions } from '../editor/extensions'
import * as db from './db'
import { DEFAULT_HTML } from './defaults'
import { DEFAULT_TITLE } from './types'
import type { DocumentBody, DocumentMeta } from './types'

const LEGACY_KEY = 'porky-doc-v1'
const MIGRATED_KEY = 'porky-migrated-v2'
const ACTIVE_KEY = 'porky-active-doc'

function readLocal(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private browsing and full quotas are survivable; IndexedDB holds the data.
  }
}

export function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function countWords(content: JSONContent): number {
  let text = ''
  const walk = (node: JSONContent) => {
    if (typeof node.text === 'string') text += `${node.text} `
    node.content?.forEach(walk)
  }
  walk(content)
  const words = text.trim().match(/\S+/g)
  return words ? words.length : 0
}

function makeMeta(title: string, words: number): DocumentMeta {
  const now = Date.now()
  return { id: newId(), title, createdAt: now, updatedAt: now, words }
}

export function activeId() {
  return readLocal(ACTIVE_KEY)
}

export function setActiveId(id: string) {
  writeLocal(ACTIVE_KEY, id)
}

export async function createDocument(
  title = DEFAULT_TITLE,
  content?: JSONContent,
): Promise<{ meta: DocumentMeta; body: DocumentBody }> {
  const doc = content ?? (generateJSON('<p></p>', buildExtensions()) as JSONContent)
  const meta = makeMeta(title, countWords(doc))
  const body: DocumentBody = { id: meta.id, content: doc }
  await db.putDocument(meta, body)
  return { meta, body }
}

export async function saveDocument(
  meta: DocumentMeta,
  content: JSONContent,
): Promise<DocumentMeta> {
  const next: DocumentMeta = { ...meta, updatedAt: Date.now(), words: countWords(content) }
  await db.putDocument(next, { id: meta.id, content })
  return next
}

export async function renameDocument(meta: DocumentMeta, title: string): Promise<DocumentMeta> {
  const next: DocumentMeta = { ...meta, title: title.trim() || DEFAULT_TITLE, updatedAt: Date.now() }
  await db.putMeta(next)
  return next
}

export async function duplicateDocument(meta: DocumentMeta) {
  const body = await db.getBody(meta.id)
  const content = body ? (structuredClone(body.content) as JSONContent) : undefined
  return createDocument(`${meta.title} (copy)`, content)
}

export async function deleteDocument(id: string) {
  await db.deleteDocument(id)
}

export const readBody = db.getBody

/**
 * The single localStorage draft from the first version becomes a document.
 * The old key is deliberately left in place: it is a few kilobytes, and if
 * this conversion is ever wrong the original is still recoverable.
 */
async function migrateLegacyDraft(): Promise<void> {
  if (readLocal(MIGRATED_KEY)) return

  try {
    const raw = readLocal(LEGACY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; title?: string; html?: string }
      if (parsed?.version === 1 && typeof parsed.html === 'string') {
        const content = generateJSON(parsed.html, buildExtensions()) as JSONContent
        const title = typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title
          : DEFAULT_TITLE
        const meta = makeMeta(title, countWords(content))
        await db.putDocument(meta, { id: meta.id, content })
      }
    }
  } catch {
    // A corrupt legacy record must not stop the app from opening.
  }

  writeLocal(MIGRATED_KEY, '1')
}

export type Bootstrap = {
  metas: DocumentMeta[]
  active: DocumentMeta
  body: DocumentBody
}

export async function bootstrap(): Promise<Bootstrap> {
  await migrateLegacyDraft()

  let metas = await db.listMeta()

  if (!metas.length) {
    const seed = generateJSON(DEFAULT_HTML, buildExtensions()) as JSONContent
    const { meta } = await createDocument(DEFAULT_TITLE, seed)
    metas = [meta]
  }

  metas.sort((a, b) => b.updatedAt - a.updatedAt)

  const remembered = activeId()
  const active = metas.find((meta) => meta.id === remembered) ?? metas[0]

  let body = await db.getBody(active.id)
  if (!body) {
    // Metadata without a body should not happen, but an empty document beats
    // a blank screen.
    body = { id: active.id, content: generateJSON('<p></p>', buildExtensions()) as JSONContent }
    await db.putDocument(active, body)
  }

  setActiveId(active.id)
  return { metas, active, body }
}
