'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { del, get, set } from 'idb-keyval'
import type { JSONContent } from '@tiptap/core'
import { contextFingerprint, defaultProject } from './model'
import type {
  CheckerFlag,
  Comment,
  Context,
  FinalCheckReport,
  PlanChatMessage,
  PlanNode,
  Project,
  Source,
  Suggestion,
  Tab,
} from './model'
import type { CapturedSelection } from '@/editor/commands'

/**
 * One store for the whole project. Persisted to IndexedDB (source texts can
 * be a few hundred KB, which is more than localStorage should carry) so a
 * refresh during the demo loses nothing.
 */

const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (typeof indexedDB === 'undefined') return null
    try {
      const value = await get(name)
      if (value == null) return null
      return typeof value === 'string' ? value : JSON.stringify(value)
    } catch {
      return null
    }
  },
  setItem: async (name, value) => {
    if (typeof indexedDB === 'undefined') return
    try {
      await set(name, value)
    } catch {
      // Quota or a locked DB should not freeze the app.
    }
  },
  removeItem: async (name) => {
    if (typeof indexedDB === 'undefined') return
    try {
      await del(name)
    } catch {
      // ignore
    }
  },
}

function finishHydration() {
  const s = useProject.getState()
  try {
    if (s.plan.length && !s.planContextFingerprint && s.context) {
      useProject.setState({ planContextFingerprint: contextFingerprint(s.context), hydrated: true })
      return
    }
  } catch {
    // Corrupt persisted context should still open the editor.
  }
  if (!s.hydrated) useProject.setState({ hydrated: true })
}

export type ProjectState = Project & {
  tab: Tab
  hydrated: boolean
  /** Paragraph the cursor is in; drives the outline highlight. */
  activeParagraphId: string | null
  /** Bumped whenever the plan changes so Write can re-run mismatch checks. */
  planVersion: number
  /** Pending request for the agent panel from elsewhere in the UI. */
  agentRequest: { id: string; prompt: string; paragraphId?: string; selection?: string } | null
  /** Comment whose card is open; highlights its anchor. */
  activeCommentId: string | null
  /** Whether the left sidebar in Write mode is open. */
  sidebarOpen: boolean
  /** Sections whose order in the essay differs from the plan. */
  sectionMismatch: { outOfOrder: string[] }
  /** A citation was just inserted; the live checker picks this up. */
  citationCheckRequest: { id: string; sourceId: string } | null
  /** Paragraph to scroll to after switching to Write. */
  pendingScrollParagraphId: string | null
  /** Essay text marked for the agent; survives clicking the chat. */
  heldSelection: CapturedSelection | null
  /** Pending prompt for the plan chat (e.g. redo after context drift). */
  planRequest: { id: string; prompt: string } | null

  setTab: (tab: Tab) => void
  setHeldSelection: (selection: CapturedSelection | null) => void
  clearHeldSelection: () => void
  requestPlanRevision: (prompt: string) => void
  clearPlanRequest: () => void
  acknowledgeContextDrift: () => void
  setActiveComment: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  setSectionMismatch: (mismatch: { outOfOrder: string[] }) => void
  requestCitationCheck: (sourceId: string) => void
  clearCitationCheck: () => void
  setPendingScroll: (id: string | null) => void
  setHydrated: () => void
  setTitle: (title: string) => void
  updateContext: (patch: Partial<Context>) => void

  addSource: (source: Source) => void
  updateSource: (id: string, patch: Partial<Source>) => void
  removeSource: (id: string) => void

  setPlan: (plan: PlanNode[]) => void
  updateNode: (id: string, patch: Partial<PlanNode>) => void
  addNode: (node: PlanNode, index?: number) => void
  removeNode: (id: string) => void
  moveNode: (id: string, direction: -1 | 1) => void
  setPlanChat: (messages: PlanChatMessage[]) => void
  setPlanStatus: (status: Project['planStatus']) => void
  setNodeFlags: (flags: Record<string, PlanNode['flags']>) => void

  setDoc: (doc: JSONContent) => void
  setActiveParagraph: (id: string | null) => void

  addSuggestion: (s: Suggestion) => void
  removeSuggestion: (id: string) => void
  clearSuggestions: () => void

  addComment: (c: Comment) => void
  updateComment: (id: string, patch: Partial<Comment>) => void
  removeComment: (id: string) => void

  setCheckerFlag: (flag: CheckerFlag) => void
  clearCheckerFlag: (paragraphId: string) => void
  dismissCheckerFlag: (paragraphId: string) => void
  setCheckersEnabled: (on: boolean) => void

  setReport: (report: FinalCheckReport | null) => void
  requestAgent: (request: { prompt: string; paragraphId?: string; selection?: string }) => void
  clearAgentRequest: () => void
  resetProject: () => void
}

const touch = () => ({ updatedAt: Date.now() })

export const useProject = create<ProjectState>()(
  persist(
    (setState, getState) => ({
      ...defaultProject(),
      tab: 'context',
      hydrated: false,
      activeParagraphId: null,
      planVersion: 0,
      agentRequest: null,
      activeCommentId: null,
      sidebarOpen: true,
      sectionMismatch: { outOfOrder: [] },
      citationCheckRequest: null,
      pendingScrollParagraphId: null,
      heldSelection: null,
      planRequest: null,

      setTab: (tab) => setState({ tab }),
      setHeldSelection: (heldSelection) => {
        const current = getState().heldSelection
        if (
          current?.text === heldSelection?.text &&
          (current?.paragraphIds.join('|') ?? '') === (heldSelection?.paragraphIds.join('|') ?? '')
        ) {
          return
        }
        setState({ heldSelection })
      },
      clearHeldSelection: () => {
        if (getState().heldSelection) setState({ heldSelection: null })
      },
      requestPlanRevision: (prompt) =>
        setState({ planRequest: { id: Math.random().toString(36).slice(2), prompt }, tab: 'plan' }),
      clearPlanRequest: () => setState({ planRequest: null }),
      acknowledgeContextDrift: () =>
        setState((s) => ({ planContextFingerprint: contextFingerprint(s.context), ...touch() })),
      setActiveComment: (activeCommentId) => setState({ activeCommentId }),
      setSidebarOpen: (sidebarOpen) => setState({ sidebarOpen }),
      setSectionMismatch: (sectionMismatch) => {
        const current = getState().sectionMismatch
        if (current.outOfOrder.join('|') !== sectionMismatch.outOfOrder.join('|')) setState({ sectionMismatch })
      },
      requestCitationCheck: (sourceId) =>
        setState({ citationCheckRequest: { id: Math.random().toString(36).slice(2), sourceId } }),
      clearCitationCheck: () => setState({ citationCheckRequest: null }),
      setPendingScroll: (pendingScrollParagraphId) => setState({ pendingScrollParagraphId }),
      setHydrated: () => setState({ hydrated: true }),
      setTitle: (title) => setState({ title, ...touch() }),
      updateContext: (patch) =>
        setState((s) => ({ context: { ...s.context, ...patch }, ...touch() })),

      addSource: (source) => setState((s) => ({ sources: [...s.sources, source], ...touch() })),
      updateSource: (id, patch) =>
        setState((s) => ({
          sources: s.sources.map((src) => (src.id === id ? { ...src, ...patch } : src)),
          ...touch(),
        })),
      removeSource: (id) =>
        setState((s) => ({ sources: s.sources.filter((src) => src.id !== id), ...touch() })),

      setPlan: (plan) =>
        setState((s) => ({
          plan,
          planVersion: s.planVersion + 1,
          planStatus: plan.length ? 'ready' : s.planStatus,
          planContextFingerprint: plan.length ? contextFingerprint(s.context) : null,
          ...touch(),
        })),
      updateNode: (id, patch) =>
        setState((s) => ({
          plan: s.plan.map((n) => (n.id === id ? { ...n, ...patch } : n)),
          planVersion: s.planVersion + 1,
          ...touch(),
        })),
      addNode: (node, index) =>
        setState((s) => {
          const plan = [...s.plan]
          plan.splice(index ?? plan.length, 0, node)
          return {
            plan,
            planVersion: s.planVersion + 1,
            planStatus: 'ready',
            planContextFingerprint: s.planContextFingerprint ?? contextFingerprint(s.context),
            ...touch(),
          }
        }),
      removeNode: (id) =>
        setState((s) => {
          const plan = s.plan.filter((n) => n.id !== id)
          return {
            plan,
            planVersion: s.planVersion + 1,
            planContextFingerprint: plan.length ? s.planContextFingerprint : null,
            ...touch(),
          }
        }),
      moveNode: (id, direction) =>
        setState((s) => {
          const index = s.plan.findIndex((n) => n.id === id)
          const target = index + direction
          if (index < 0 || target < 0 || target >= s.plan.length) return {}
          const plan = [...s.plan]
          const [node] = plan.splice(index, 1)
          plan.splice(target, 0, node)
          return { plan, planVersion: s.planVersion + 1, ...touch() }
        }),
      setPlanChat: (planChat) => setState({ planChat, ...touch() }),
      setPlanStatus: (planStatus) => setState({ planStatus }),
      setNodeFlags: (flags) =>
        setState((s) => ({
          plan: s.plan.map((n) => ({ ...n, flags: flags[n.id] ?? [] })),
          ...touch(),
        })),

      setDoc: (doc) => setState({ doc, ...touch() }),
      setActiveParagraph: (activeParagraphId) => {
        if (getState().activeParagraphId !== activeParagraphId) setState({ activeParagraphId })
      },

      addSuggestion: (suggestion) =>
        setState((s) => ({ suggestions: [...s.suggestions, suggestion], ...touch() })),
      removeSuggestion: (id) =>
        setState((s) => ({ suggestions: s.suggestions.filter((x) => x.id !== id), ...touch() })),
      clearSuggestions: () => setState({ suggestions: [], ...touch() }),

      addComment: (comment) => setState((s) => ({ comments: [...s.comments, comment], ...touch() })),
      updateComment: (id, patch) =>
        setState((s) => ({
          comments: s.comments.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          ...touch(),
        })),
      removeComment: (id) =>
        setState((s) => ({ comments: s.comments.filter((c) => c.id !== id), ...touch() })),

      setCheckerFlag: (flag) =>
        setState((s) => ({ checkerFlags: { ...s.checkerFlags, [flag.paragraphId]: flag } })),
      clearCheckerFlag: (paragraphId) =>
        setState((s) => {
          if (!s.checkerFlags[paragraphId]) return {}
          const next = { ...s.checkerFlags }
          delete next[paragraphId]
          return { checkerFlags: next }
        }),
      dismissCheckerFlag: (paragraphId) =>
        setState((s) => {
          const flag = s.checkerFlags[paragraphId]
          if (!flag) return {}
          return { checkerFlags: { ...s.checkerFlags, [paragraphId]: { ...flag, dismissed: true } } }
        }),
      setCheckersEnabled: (checkersEnabled) => setState({ checkersEnabled }),

      setReport: (report) => setState({ report, ...touch() }),
      requestAgent: (request) =>
        setState({ agentRequest: { id: Math.random().toString(36).slice(2), ...request }, tab: 'write' }),
      clearAgentRequest: () => setState({ agentRequest: null }),
      resetProject: () =>
        setState({ ...defaultProject(), tab: 'context', planVersion: 0, heldSelection: null, planRequest: null }),
    }),
    {
      name: 'porky-essay-v1',
      storage: createJSONStorage(() => idbStorage),
      skipHydration: true,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ProjectState>
        return {
          ...current,
          ...saved,
          context: { ...current.context, ...(saved.context ?? {}) },
          plan: saved.plan ?? current.plan,
          sources: saved.sources ?? current.sources,
        }
      },
      partialize: (state) => {
        // Transient UI state is not persisted.
        const {
          hydrated,
          activeParagraphId,
          agentRequest,
          planVersion,
          activeCommentId,
          sectionMismatch,
          citationCheckRequest,
          pendingScrollParagraphId,
          heldSelection,
          planRequest,
          ...rest
        } = state
        void hydrated
        void activeParagraphId
        void agentRequest
        void planVersion
        void activeCommentId
        void sectionMismatch
        void citationCheckRequest
        void pendingScrollParagraphId
        void heldSelection
        void planRequest
        return rest as Omit<
          ProjectState,
          | 'hydrated'
          | 'activeParagraphId'
          | 'agentRequest'
          | 'planVersion'
          | 'activeCommentId'
          | 'sectionMismatch'
          | 'citationCheckRequest'
          | 'pendingScrollParagraphId'
          | 'heldSelection'
          | 'planRequest'
        >
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.warn('Porky could not restore the last session.', error)
        finishHydration()
      },
    },
  ),
)

/** Load IndexedDB into the store. Safe to call more than once. */
export function rehydrateProject(): Promise<void> {
  if (useProject.persist.hasHydrated()) {
    finishHydration()
    return Promise.resolve()
  }
  return Promise.resolve(useProject.persist.rehydrate()).then(() => undefined)
}

/** Selectors used from several places. */
export const selectPendingSuggestions = (s: ProjectState) => s.suggestions
export const selectLockedParagraphIds = (s: ProjectState) => new Set(s.suggestions.map((x) => x.paragraphId))
export const selectContextDrifted = (s: ProjectState) =>
  s.plan.length > 0 &&
  s.planContextFingerprint != null &&
  Boolean(s.context) &&
  contextFingerprint(s.context) !== s.planContextFingerprint
