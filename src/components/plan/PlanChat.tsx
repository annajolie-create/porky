'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { Dots, ErrorNote, cx } from '../ui'
import { useProject } from '@/lib/store'
import { newId } from '@/lib/ids'
import type { PlanChatMessage, PlanNode, PlanQuestion } from '@/lib/model'
import { contextPayload, planPayload, sourcesPayload } from '@/lib/payload'
import { postJSON } from '@/lib/sse'

type Reply = {
  type: 'questions' | 'plan' | 'reply'
  message: string
  questions: { id: string; prompt: string; placeholder?: string }[] | null
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

export const KICKOFF = 'Please help me plan this essay. Ask me what you need to know first.'

export const REDO_PLAN_PROMPT =
  'The assignment context has changed. Please redo the plan for the updated task, framework, grading scheme, length, style and language. Keep existing section ids wherever the same section still belongs, so written paragraphs stay assigned.'

const STARTERS = [
  { label: 'Propose a plan', prompt: 'Propose a complete plan for this essay from the task and sources.' },
  { label: 'Add a section', prompt: 'Suggest a new section I should add, and where it belongs in the argument.' },
  { label: 'Check the argument', prompt: 'Look at the current plan and tell me whether the argument holds together. Do not rewrite it unless I ask.' },
]

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
  const planRequest = useProject((s) => s.planRequest)
  const clearPlanRequest = useProject((s) => s.clearPlanRequest)
  const setTab = useProject((s) => s.setTab)
  const empty = messages.length === 0

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
      const questions = normaliseQuestions(reply)
      const incoming: PlanChatMessage = {
        id: newId('m'),
        role: 'assistant',
        content: reply.message,
        questions: questions.length ? questions : undefined,
      }
      setPlanChat([...history, incoming])
      if (reply.type === 'questions' || questions.length) setPlanStatus('asking')
      if (reply.type === 'plan' && reply.plan) {
        setPlan(mergePlan(plan, reply.plan, sources.map((s) => s.id)))
        setPlanStatus('ready')
      }
      if (reply.type === 'reply') setPlanStatus(plan.length ? 'ready' : 'empty')
    } catch (e) {
      setError((e as Error).message)
      setPlanChat(history.filter((m) => m.id !== outgoing.id || !hidden))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!planRequest) return
    const prompt = planRequest.prompt
    clearPlanRequest()
    void send(prompt, prompt === KICKOFF && messages.length === 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planRequest?.id])

  const submit = () => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    void send(text)
  }

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-soft flex flex-col h-full min-h-0">
      <div className="px-4 py-3.5 border-b border-line flex items-center gap-2.5">
        <span className="size-7 rounded-lg bg-gold-soft text-gold grid place-items-center">
          <Sparkle size={14} weight="fill" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-none">Planning assistant</p>
          <p className="text-[12px] text-muted mt-1">Knows your task, sources & plan</p>
        </div>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {empty && !busy ? (
          <div className="text-[13px] text-ink-soft leading-relaxed">
            <p>
              I can help you shape the argument, add or rewrite sections, or draft a full plan from the task and
              sources.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={s.label === 'Propose a plan' && !context.task.trim()}
                  onClick={() => void send(s.prompt)}
                  className="rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] hover:border-gold hover:bg-accent-soft hover:text-gold-ink disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-paper disabled:hover:text-ink-soft"
                >
                  {s.label}
                </button>
              ))}
            </div>
            {!context.task.trim() ? (
              <p className="mt-3 text-[12px] text-muted">
                Add the task in{' '}
                <button type="button" onClick={() => setTab('context')} className="text-accent hover:underline">
                  Context
                </button>{' '}
                first if you want a full plan.
              </p>
            ) : null}
          </div>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cx('fade-in text-[13px] leading-relaxed whitespace-pre-wrap flex', m.role === 'user' ? 'justify-end' : '')}
          >
            <div
              className={cx(
                'rounded-2xl px-3.5 py-2.5 max-w-[95%]',
                m.role === 'user' ? 'bg-gold-soft text-ink' : 'bg-paper text-ink',
              )}
            >
              {displayContent(m)}
            </div>
          </div>
        ))}

        {busy ? (
          <div className="px-1">
            <Dots label={plan.length ? 'Working' : 'Thinking'} />
          </div>
        ) : null}

        {error ? <ErrorNote message={error} onRetry={() => lastPrompt && void send(lastPrompt, messages.length === 0)} /> : null}
      </div>

      <div className="shrink-0 p-3 border-t border-line">
        <div className="flex items-end gap-2 rounded-xl bg-paper pl-3.5 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-gold/20">
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
            placeholder="Ask about the argument, or describe a change…"
            className="flex-1 min-h-8 resize-none bg-transparent py-1.5 text-[13px] leading-5 outline-none placeholder:text-muted/70"
            disabled={busy}
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="size-8 rounded-lg bg-gold text-ink grid place-items-center disabled:opacity-40"
          >
            <ArrowUp size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}

function displayContent(message: PlanChatMessage): string {
  if (message.role !== 'assistant' || !message.questions?.length) return message.content
  if (parseQuestions(message.content).length >= 2) return message.content
  const list = message.questions.map((q, i) => `${i + 1}. ${q.prompt}`).join('\n')
  return [message.content.trim(), list].filter(Boolean).join('\n\n')
}

function normaliseQuestions(reply: Reply): PlanQuestion[] {
  const fromApi = (reply.questions ?? [])
    .map((q, i) => ({
      id: q.id?.trim() || String(i + 1),
      prompt: q.prompt?.trim() ?? '',
      placeholder: q.placeholder?.trim() || undefined,
    }))
    .filter((q) => q.prompt)
  if (fromApi.length) return fromApi
  if (reply.type === 'questions') return parseQuestions(reply.message)
  return []
}

function parseQuestions(text: string): PlanQuestion[] {
  const items: { id: string; prompt: string }[] = []
  let current: { id: string; prompt: string } | null = null
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim()
    const match = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (match) {
      if (current?.prompt) items.push(current)
      current = { id: match[1], prompt: match[2].trim() }
    } else if (current && line) {
      current.prompt = `${current.prompt} ${line}`
    }
  }
  if (current?.prompt) items.push(current)
  return items.filter((q) => q.prompt.length > 8)
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
