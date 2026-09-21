'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { Button, Dots, ErrorNote, Textarea, cx } from '../ui'
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

export function PlanChat() {
  const messages = useProject((s) => s.planChat)
  const setPlanChat = useProject((s) => s.setPlanChat)
  const setPlanStatus = useProject((s) => s.setPlanStatus)
  const setPlan = useProject((s) => s.setPlan)
  const plan = useProject((s) => s.plan)
  const context = useProject((s) => s.context)
  const sources = useProject((s) => s.sources)
  const planStatus = useProject((s) => s.planStatus)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const planRequest = useProject((s) => s.planRequest)
  const clearPlanRequest = useProject((s) => s.clearPlanRequest)
  const setTab = useProject((s) => s.setTab)
  const empty = messages.length === 0
  const pendingQuestions = useMemo(() => pendingQuestionSet(messages, planStatus === 'asking'), [messages, planStatus])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    if (pendingQuestions) {
      const form = el.querySelector('form')
      if (form instanceof HTMLElement) {
        const top = form.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 16
        el.scrollTo({ top: Math.max(0, top) })
        return
      }
    }
    el.scrollTo({ top: el.scrollHeight })
  }, [messages, busy, pendingQuestions])

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

  const showComposer = !empty && !pendingQuestions && !busy

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-soft flex flex-col h-full min-h-0">
      <div className="px-4 py-3.5 border-b border-line flex items-center gap-2.5">
        <span className="size-7 rounded-lg bg-gold-soft text-gold grid place-items-center">
          <Sparkle size={14} weight="fill" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-none">Planning assistant</p>
          <p className="text-[12px] text-muted mt-1">
            {pendingQuestions ? 'Answer these to shape the plan' : 'Shaping your argument'}
          </p>
        </div>
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
            {!context.task.trim() ? (
              <p className="mt-2 text-[12px] text-muted">
                Add the task in{' '}
                <button type="button" onClick={() => setTab('context')} className="text-accent hover:underline">
                  Context
                </button>{' '}
                first.
              </p>
            ) : null}
            {!sources.length ? <p className="mt-2 text-[12px] text-muted">Tip: add sources first so evidence can be linked.</p> : null}
          </div>
        ) : null}

        {messages.map((m, index) => {
          const unanswered = !messages.slice(index + 1).some((x) => x.role === 'user')
          const questions = questionsOf(m, unanswered && planStatus === 'asking')
          if (m.role === 'assistant' && questions.length) {
            return (
              <div key={m.id} className="fade-in space-y-3">
                {m.content.trim() && !looksLikeNumberedList(m.content) ? (
                  <div className="rounded-2xl bg-paper px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
                    {m.content}
                  </div>
                ) : null}
                {unanswered && !busy ? (
                  <QuestionForm questions={questions} disabled={busy} onSubmit={(text) => void send(text)} />
                ) : unanswered ? null : (
                  <p className="text-[12px] text-muted px-1">{questions.length} questions answered</p>
                )}
              </div>
            )
          }
          return (
            <div key={m.id} className={cx('fade-in text-[13px] leading-relaxed whitespace-pre-wrap flex', m.role === 'user' ? 'justify-end' : '')}>
              <div
                className={cx(
                  'rounded-2xl px-3.5 py-2.5 max-w-[95%]',
                  m.role === 'user' ? 'bg-gold-soft text-ink' : 'bg-paper text-ink',
                )}
              >
                {m.content}
              </div>
            </div>
          )
        })}

        {busy ? (
          <div className="px-1">
            <Dots label={plan.length ? 'Revising the plan' : messages.length <= 1 ? 'Reading your task and sources' : 'Building the plan'} />
          </div>
        ) : null}

        {error ? <ErrorNote message={error} onRetry={() => lastPrompt && void send(lastPrompt, messages.length === 0)} /> : null}
      </div>

      {showComposer ? (
        <div className="p-3 border-t border-line">
          <div className="flex items-end gap-2 rounded-xl bg-paper px-3 py-2 focus-within:ring-2 focus-within:ring-gold/20">
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
              placeholder="Reply to shape your plan…"
              className="flex-1 resize-none bg-transparent text-[13px] outline-none placeholder:text-muted/70"
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
      ) : null}
    </div>
  )
}

function QuestionForm({
  questions,
  disabled,
  onSubmit,
}: {
  questions: PlanQuestion[]
  disabled: boolean
  onSubmit: (text: string) => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [extra, setExtra] = useState('')
  const filled = questions.every((q) => (answers[q.id] ?? '').trim())

  const submit = () => {
    if (!filled || disabled) return
    const lines = questions.map((q, i) => `${i + 1}. ${q.prompt}\n${(answers[q.id] ?? '').trim()}`)
    if (extra.trim()) lines.push(`Anything else:\n${extra.trim()}`)
    onSubmit(lines.join('\n\n'))
  }

  return (
    <form
      className="rounded-2xl border border-line bg-surface p-3.5 space-y-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {questions.map((q, i) => (
        <label key={q.id} className="block">
          <span className="flex items-start gap-2 mb-1.5">
            <span className="size-5 shrink-0 mt-0.5 rounded-full bg-gold text-ink grid place-items-center text-[11px] font-semibold tabular-nums">
              {i + 1}
            </span>
            <span className="text-[13.5px] font-semibold leading-snug text-ink">{q.prompt}</span>
          </span>
          <Textarea
            value={answers[q.id] ?? ''}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
            placeholder={q.placeholder || 'Your answer'}
            rows={2}
            className="min-h-[72px] text-[13.5px]"
            disabled={disabled}
          />
        </label>
      ))}
      <label className="block">
        <span className="block text-[12px] text-muted mb-1.5">Anything else? optional</span>
        <Textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="A constraint, a section you already know you want…"
          rows={2}
          className="min-h-[64px] text-[13.5px]"
          disabled={disabled}
        />
      </label>
      <Button type="submit" variant="primary" className="w-full" disabled={disabled || !filled}>
        Build the plan
      </Button>
    </form>
  )
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

function questionsOf(message: PlanChatMessage, allowParse: boolean): PlanQuestion[] {
  if (message.role !== 'assistant') return []
  if (message.questions?.length) return message.questions
  if (allowParse) return parseQuestions(message.content)
  return []
}

function pendingQuestionSet(messages: PlanChatMessage[], asking: boolean): PlanQuestion[] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user') return null
    const questions = questionsOf(m, asking)
    if (questions.length) return questions
  }
  return null
}

function looksLikeNumberedList(text: string): boolean {
  return parseQuestions(text).length >= 2
}

/** Pull "1. …" / "1) …" items out of a prose message so older replies still become a form. */
export function parseQuestions(text: string): PlanQuestion[] {
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
