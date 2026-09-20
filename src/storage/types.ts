import type { JSONContent } from '@tiptap/react'

export type DocumentMeta = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  /** Denormalised so the drawer can list documents without loading bodies. */
  words: number
}

export type DocumentBody = {
  id: string
  content: JSONContent
}

export const DEFAULT_TITLE = 'Untitled document'
