'use client'

import { createContext, useContext } from 'react'
import type { Editor } from '@tiptap/react'

export const EditorContext = createContext<Editor | null>(null)

export function useEssayEditorContext(): Editor | null {
  return useContext(EditorContext)
}
