import type { DocumentBody, DocumentMeta } from './types'

/**
 * Two stores rather than one: the drawer lists documents constantly, and a
 * body carries every embedded image with it. Keeping metadata separate means
 * listing never pulls megabytes of base64 into memory.
 */

const DB_NAME = 'porky'
const DB_VERSION = 1
const META = 'meta'
const BODIES = 'bodies'

let connection: Promise<IDBDatabase> | null = null

export class StorageUnavailable extends Error {}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

function openDb(): Promise<IDBDatabase> {
  if (connection) return connection

  connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageUnavailable('IndexedDB is not available in this browser'))
      return
    }

    const open = indexedDB.open(DB_NAME, DB_VERSION)

    open.onupgradeneeded = () => {
      const db = open.result
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(BODIES)) db.createObjectStore(BODIES, { keyPath: 'id' })
    }

    open.onsuccess = () => resolve(open.result)
    open.onerror = () =>
      reject(new StorageUnavailable(open.error?.message ?? 'Could not open IndexedDB'))
    open.onblocked = () => reject(new StorageUnavailable('IndexedDB is blocked by another tab'))
  })

  // A failed open must not be cached, or a transient failure would be permanent.
  connection.catch(() => {
    connection = null
  })

  return connection
}

async function withStores<T>(
  names: string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDb()
  const tx = db.transaction(names, mode)
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })

  const result = await run(tx)
  // Resolve only once the write is durable, so "Saved" means saved.
  if (mode !== 'readonly') await done
  return result
}

export function listMeta(): Promise<DocumentMeta[]> {
  return withStores([META], 'readonly', (tx) =>
    request(tx.objectStore(META).getAll() as IDBRequest<DocumentMeta[]>),
  )
}

export function getBody(id: string): Promise<DocumentBody | undefined> {
  return withStores([BODIES], 'readonly', (tx) =>
    request(tx.objectStore(BODIES).get(id) as IDBRequest<DocumentBody | undefined>),
  )
}

export function putDocument(meta: DocumentMeta, body: DocumentBody): Promise<void> {
  return withStores([META, BODIES], 'readwrite', async (tx) => {
    tx.objectStore(META).put(meta)
    tx.objectStore(BODIES).put(body)
  })
}

export function putMeta(meta: DocumentMeta): Promise<void> {
  return withStores([META], 'readwrite', async (tx) => {
    tx.objectStore(META).put(meta)
  })
}

export function deleteDocument(id: string): Promise<void> {
  return withStores([META, BODIES], 'readwrite', async (tx) => {
    tx.objectStore(META).delete(id)
    tx.objectStore(BODIES).delete(id)
  })
}
