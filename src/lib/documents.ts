import { del, get, set } from 'idb-keyval'
import { docText } from './doc'
import { newId } from './ids'
import type { Project } from './model'
import { defaultProject } from './model'

const INDEX_KEY = 'essai-docs-index-v1'
const snapKey = (id: string) => `essai-doc-${id}`

export type DocRecord = {
  id: string
  title: string
  updatedAt: number
  preview: string
}

export function projectSnapshot(project: Project): Project {
  return {
    id: project.id,
    title: project.title,
    context: project.context,
    sources: project.sources,
    plan: project.plan,
    planChat: project.planChat,
    planStatus: project.planStatus,
    doc: project.doc,
    suggestions: project.suggestions,
    comments: project.comments,
    checkerFlags: project.checkerFlags,
    checkersEnabled: project.checkersEnabled,
    report: project.report,
    planContextFingerprint: project.planContextFingerprint,
    updatedAt: project.updatedAt,
  }
}

export function isBlankProject(project: Project): boolean {
  try {
    const writing = docText(project.doc ?? { type: 'doc' }, project.sources ?? []).trim()
    return (
      !project.title?.trim() &&
      !writing &&
      !(project.plan?.length) &&
      !(project.sources?.length) &&
      !project.context?.task?.trim()
    )
  } catch {
    return false
  }
}

export function previewOf(project: Project): string {
  try {
    return docText(project.doc ?? { type: 'doc' }, project.sources ?? []).replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

export async function listDocs(): Promise<DocRecord[]> {
  if (typeof indexedDB === 'undefined') return []
  try {
    const index = (await get(INDEX_KEY)) as DocRecord[] | undefined
    return [...(index ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export async function upsertDoc(project: Project): Promise<void> {
  if (typeof indexedDB === 'undefined' || !project?.id) return
  try {
    const record: DocRecord = {
      id: project.id,
      title: project.title?.trim() || 'Untitled',
      updatedAt: project.updatedAt || Date.now(),
      preview: previewOf(project),
    }
    const index = await listDocs()
    await set(snapKey(project.id), projectSnapshot(project))
    await set(INDEX_KEY, [record, ...index.filter((d) => d.id !== project.id)])
  } catch {
    // A locked or quota-full DB should not freeze the workplace.
  }
}

export async function loadDoc(id: string): Promise<Project | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const value = await get(snapKey(id))
    if (!value || typeof value !== 'object') return null
    return { ...defaultProject(), ...(value as Project), id }
  } catch {
    return null
  }
}

export async function removeDoc(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const index = await listDocs()
  await set(INDEX_KEY, index.filter((d) => d.id !== id))
  await del(snapKey(id))
}

export function newDocumentId(): string {
  return newId('doc')
}

const OPEN_KEY = 'essai-open-doc'

export function requestOpenDoc(id: string) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(OPEN_KEY, id)
}

export function takeOpenDocRequest(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  const id = sessionStorage.getItem(OPEN_KEY)
  if (id) sessionStorage.removeItem(OPEN_KEY)
  return id
}

export function clearOpenDocRequest() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(OPEN_KEY)
}

const CREATE_KEY = 'essai-create-doc'

export function requestCreateDoc(title: string) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(CREATE_KEY, title)
}

export function takeCreateDocRequest(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  const title = sessionStorage.getItem(CREATE_KEY)
  if (title != null) sessionStorage.removeItem(CREATE_KEY)
  return title
}

export function formatAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 45) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(timestamp).toLocaleDateString()
}
