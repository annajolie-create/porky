'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { Button, Dots, ErrorNote, cx } from '../ui'
import { useProject } from '@/lib/store'
import { newId } from '@/lib/ids'
import type { PlanChatMessage, PlanNode } from '@/lib/model'
import { contextPayload, planPayload, sourcesPayload } from '@/lib/payload'
import { postJSON } from '@/lib/sse'

type Reply = {
  type: 'questions' | 'plan' | 'reply'
  message: string
  plan:
    | {
        id: string
        title: string
        claim: string
        keyPoints: string[]
        evidence: { text: string; sourceId: string | null }[]
        targetWords: number | null
      }[]
    | null
}

const KICKOFF = 'Please help me plan this essay. Ask me what you need to know first.'

export function PlanChat() {
  const messages = useProject((s) => s.planChat)
  const setPlanChat = useProject((s) => s.setPlanChat)
  const setPlanStatus = useProject((s) => s.setPlanStatus)
  const setPlan = useProject((s) => s.setPlan)
  const plan = useProject((s) => s.plan)
  const context = useProject((s) => s.context)
  const sources = useProject((s) => s.sources)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages, busy])

  const send = async (text: string, hidden = false) => {
    const outgoing: PlanChatMessage = { id: newId('m'), role: 'user', content: text }
    const history = hidden && messages.length === 0 ? [outgoing] : [...messages, outgoing]
    setPlanChat(hidden ? messages : history)
    setBusy(true)
    setError(null)
    setLastPrompt(text)
    try {
      const referenceNotes = context.referencePieces.length
        ? `The student provided ${context.referencePieces.length} reference piece(s) for style only; they are not sources.`
        : undefined
      const reply = await postJSON<Reply>('/api/plan/chat', {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        context: contextPayload(context),
        sources: sourcesPayload(sources, { text: true }),
        plan: planPayload(plan),
        referenceNotes,
      })
      const incoming: PlanChatMessage = { id: newId('m'), role: 'assistant', content: reply.message }
      setPlanChat([...history, incoming])
      if (reply.type === 'questions') setPlanStatus('asking')
      if (reply.type === 'plan' && reply.plan) {
        setPlan(mergePlan(plan, reply.plan, sources.map((s) => s.id)))
        setPlanStatus('ready')
      }
    } catch (e) {
      setError((e as Error).message)
      setPlanChat(history.filter((m) => m.id !== outgoing.id || !hidden))
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    void send(text)
  }

  const empty = messages.length === 0

  return (
    <div className="rounded-lg border border-line bg-surface shadow-soft flex flex-col h-[calc(100vh-11rem)] min-h-[420px]">
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        <Sparkle size={15} weight="fill" className="text-accent" />
        <span className="text-[13px] font-semibold">Plan with AI</span>
        {plan.length ? <span className="ml-auto text-[12px] text-muted">Ask for changes here</span> : null}
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {empty && !busy ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <p className="text-[13.5px] text-ink-soft max-w-[30ch]">
              The AI reads your task and sources, asks a few questions, then proposes a full plan you can edit.
            </p>
            <Button
              variant="primary"
              className="mt-4"
              disabled={!context.task.trim()}
              onClick={() => void send(KICKOFF, true)}
            >
              <Sparkle size={14} weight="fill" />
              Create plan with AI
            </Button>
            {!context.task.trim() ? <p className="mt-2 text-[12px] text-muted">Add the task in the Context tab first.</p> : null}
            {!sources.length ? <p className="mt-2 text-[12px] text-muted">Tip: add sources first so evidence can be linked.</p> : null}
          </div>
        ) : null}

        {messages.map((m) => (
          <div key={m.id} className={cx('fade-in text-[13px] leading-relaxed whitespace-pre-wrap', m.role === 'user' ? 'ml-8' : '')}>
            <div className={cx('rounded-lg px-3 py-2', m.role === 'user' ? 'bg-accent-soft text-ink' : 'bg-paper text-ink')}>{m.content}</div>
          </div>
        ))}

        {busy ? (
          <div className="px-1">
            <Dots label={plan.length ? 'Revising the plan' : messages.length <= 1 ? 'Reading your task and sources' : 'Building the plan'} />
          </div>
        ) : null}

        {error ? <ErrorNote message={error} onRetry={() => lastPrompt && void send(lastPrompt, messages.length === 0)} /> : null}
      </div>

      {!empty || busy ? (
        <div className="p-3 border-t border-line">
          <div className="flex items-end gap-2 rounded-md border border-line bg-surface px-3 py-2 focus-within:border-accent">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              rows={Math.min(5, Math.max(1, draft.split('\n').length))}
              placeholder={plan.length ? 'e.g. Merge sections 2 and 3, add a counterargument on privacy' : 'Answer the questions'}
              className="flex-1 resize-none bg-transparent text-[13px] outline-none placeholder:text-muted/70"
              disabled={busy}
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="size-7 rounded-full bg-accent text-white grid place-items-center disabled:opacity-40"
            >
              <ArrowUp size={14} weight="bold" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Keeps ids of retained sections so paragraphs stay assigned; new ones get fresh ids. */
function mergePlan(current: PlanNode[], incoming: NonNullable<Reply['plan']>, sourceIds: string[]): PlanNode[] {
  const known = new Set(current.map((n) => n.id))
  const used = new Set<string>()
  return incoming.map((section) => {
    let id = section.id && known.has(section.id) && !used.has(section.id) ? section.id : newId('sec')
    while (used.has(id)) id = newId('sec')
    used.add(id)
    const existing = current.find((n) => n.id === id)
    return {
      id,
      title: section.title?.trim() || 'Untitled section',
      claim: section.claim ?? '',
      keyPoints: (section.keyPoints ?? []).map((k) => k.trim()).filter(Boolean),
      evidence: (section.evidence ?? []).map((e) => ({
        id: newId('ev'),
        text: e.text ?? '',
        sourceId: e.sourceId && sourceIds.includes(e.sourceId) ? e.sourceId : null,
      })),
      targetWords: typeof section.targetWords === 'number' ? section.targetWords : null,
      flags: existing?.flags.filter((f) => f.kind !== 'evidence') ?? [],
    }
  })
}
