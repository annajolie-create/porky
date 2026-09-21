'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp'
import { Check } from '@phosphor-icons/react/dist/csr/Check'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { Stop } from '@phosphor-icons/react/dist/csr/Stop'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { useProject } from '@/lib/store'
import { newId } from '@/lib/ids'
import { paragraphsOf } from '@/lib/doc'
import { contextPayload, planPayload, sourcesPayload } from '@/lib/payload'
import { readEvents } from '@/lib/sse'
import { selectedParagraphIds, selectedText } from '@/editor/commands'
import {
  acceptSuggestion,
  applyEditSuggestion,
  applyInsertSuggestion,
  makeEditSuggestion,
  makeInsertSuggestion,
  rejectSuggestion,
} from '@/editor/applySuggestion'
import type { Comment, Suggestion } from '@/lib/model'
import { Button, Dots, ErrorNote, cx } from '../ui'
import { useEssayEditorContext } from './EditorContext'

type ChatTurn = { id: string; role: 'user' | 'assistant'; content: string }

const STARTERS = [
  { label: 'Draft this section', prompt: 'Write the plan section the cursor is in, as finished prose with citations from the source list.' },
  { label: 'Improve selection', prompt: 'Improve the selected text: clearer, tighter, still in the same voice. Propose an edit.' },
  { label: 'Find a source', prompt: 'For the selected text (or the current paragraph), suggest the best citation from the source list and propose an edit that inserts it.' },
]

export function AgentPanel() {
  const editor = useEssayEditorContext()
  const context = useProject((s) => s.context)
  const sources = useProject((s) => s.sources)
  const plan = useProject((s) => s.plan)
  const title = useProject((s) => s.title)
  const suggestions = useProject((s) => s.suggestions)
  const addSuggestion = useProject((s) => s.addSuggestion)
  const removeSuggestion = useProject((s) => s.removeSuggestion)
  const clearSuggestions = useProject((s) => s.clearSuggestions)
  const addComment = useProject((s) => s.addComment)
  const agentRequest = useProject((s) => s.agentRequest)
  const clearAgentRequest = useProject((s) => s.clearAgentRequest)
  const activeParagraphId = useProject((s) => s.activeParagraphId)
  const heldSelection = useProject((s) => s.heldSelection)
  const clearHeldSelection = useProject((s) => s.clearHeldSelection)

  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const history = useRef<ChatTurn[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  const lastInsert = useRef<{ requested: string | null; id: string } | null>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages, status])

  useEffect(() => {
    if (!agentRequest) return
    const prompt = agentRequest.prompt
    clearAgentRequest()
    void send(prompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentRequest?.id])

  const commit = (next: ChatTurn[]) => {
    history.current = next
    setMessages(next)
  }

  const applyProposal = (data: Record<string, unknown>) => {
    if (!editor) return
    const kind = data.kind as string
    if (kind === 'edit') {
      const paragraphId = String(data.paragraphId ?? '')
      const existing = useProject.getState().suggestions.find((s) => s.paragraphId === paragraphId)
      if (existing) {
        rejectSuggestion(editor, existing)
        removeSuggestion(existing.id)
      }
      const suggestion = makeEditSuggestion({
        editor,
        paragraphId,
        newText: String(data.newText ?? ''),
        label: String(data.label ?? 'Rewrite'),
      })
      if (!suggestion) return
      if (applyEditSuggestion(editor, suggestion, useProject.getState().sources)) addSuggestion(suggestion)
    } else if (kind === 'insert') {
      const requested = data.afterParagraphId ? String(data.afterParagraphId) : null
      const afterParagraphId =
        lastInsert.current && lastInsert.current.requested === requested ? lastInsert.current.id : requested
      const suggestion = makeInsertSuggestion({
        afterParagraphId,
        sectionId: data.sectionId ? String(data.sectionId) : null,
        newText: String(data.text ?? ''),
        label: String(data.label ?? 'New paragraph'),
      })
      if (applyInsertSuggestion(editor, suggestion, useProject.getState().sources)) {
        addSuggestion(suggestion)
        lastInsert.current = { requested, id: suggestion.paragraphId }
      }
    }
  }

  const applyComment = (data: Record<string, unknown>) => {
    const comment: Comment = {
      id: newId('c'),
      paragraphId: String(data.paragraphId ?? ''),
      quote: String(data.quote ?? ''),
      author: 'agent',
      text: String(data.text ?? ''),
      replies: [],
      resolved: false,
      createdAt: Date.now(),
    }
    if (comment.paragraphId && comment.text) addComment(comment)
  }

  const send = async (prompt: string) => {
    const text = prompt.trim()
    if (!text || !editor) return
    setError(null)
    setLastPrompt(text)
    const outgoing: ChatTurn = { id: newId('m'), role: 'user', content: text }
    const replyId = newId('m')
    const turns = [...history.current, outgoing]
    commit([...turns, { id: replyId, role: 'assistant', content: '' }])

    const controller = new AbortController()
    abort.current = controller
    setBusy(true)
    setStatus('Reading the essay')
    lastInsert.current = null

    const snapshot = {
      title,
      context: contextPayload(context),
      sources: sourcesPayload(sources),
      plan: planPayload(plan),
      paragraphs: paragraphsOf(editor.getJSON(), sources).map((p) => ({
        id: p.id,
        sectionId: p.sectionId,
        text: p.text,
      })),
      selection: (() => {
        const held = useProject.getState().heldSelection
        if (held?.text) return { text: held.text, paragraphIds: held.paragraphIds }
        const sel = selectedText(editor)
        if (!sel) return undefined
        return { text: sel, paragraphIds: selectedParagraphIds(editor) }
      })(),
    }

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: turns.map((m) => ({ role: m.role, content: m.content })),
          ...snapshot,
        }),
      })
      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null)
        throw new Error((detail as { error?: string } | null)?.error ?? `The agent is unreachable (${response.status}).`)
      }
      for await (const { event, data } of readEvents(response.body)) {
        if (event === 'delta') {
          const piece = String(data.text ?? '')
          commit(
            history.current.map((m) => (m.id === replyId ? { ...m, content: m.content + piece } : m)),
          )
        } else if (event === 'status') {
          setStatus(String(data.text ?? ''))
        } else if (event === 'proposal') {
          applyProposal(data)
        } else if (event === 'comment') {
          applyComment(data)
        } else if (event === 'error') {
          throw new Error(String(data.message ?? 'The agent failed.'))
        }
      }
    } catch (caught) {
      if ((caught as Error)?.name === 'AbortError') {
        // keep streamed text
      } else {
        setError((caught as Error).message)
        commit(history.current.filter((m) => !(m.id === replyId && !m.content)))
      }
    } finally {
      abort.current = null
      setBusy(false)
      setStatus(null)
    }
  }

  const stop = () => {
    abort.current?.abort()
    abort.current = null
    setBusy(false)
    setStatus(null)
  }

  const submit = () => {
    if (busy) return
    const text = draft.trim()
    if (!text) return
    setDraft('')
    void send(text)
  }

  const resolve = (suggestion: Suggestion, action: 'accept' | 'reject') => {
    if (!editor) return
    if (action === 'accept') acceptSuggestion(editor, suggestion, sources)
    else rejectSuggestion(editor, suggestion)
    removeSuggestion(suggestion.id)
  }

  const acceptAll = () => {
    if (!editor) return
    for (const s of [...suggestions]) acceptSuggestion(editor, s, sources)
    clearSuggestions()
  }

  const rejectAll = () => {
    if (!editor) return
    for (const s of [...suggestions]) rejectSuggestion(editor, s)
    clearSuggestions()
  }

  const iterate = (suggestion: Suggestion) => {
    const note = window.prompt('How should this suggestion change?')
    if (!note?.trim()) return
    void send(
      `Iterate on the pending suggestion for paragraph ${suggestion.paragraphId}. Current proposed text:\n"""${suggestion.newText}"""\n\nInstruction: ${note.trim()}\nReplace the suggestion with a new propose_edit or insert_paragraph.`,
    )
  }

  const cursorSection = plan.find((n) => {
    if (!editor || !activeParagraphId) return false
    let section: string | null = null
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'paragraph' && node.attrs.id === activeParagraphId) {
        section = node.attrs.sectionId as string | null
        return false
      }
      return true
    })
    return n.id === section
  })

  return (
    <div
      className="h-full flex flex-col min-h-0"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('textarea, input, [contenteditable="true"]')) return
        e.preventDefault()
      }}
    >
      <header className="shrink-0 px-4 py-3.5 border-b border-line flex items-center gap-2.5">
        <span className="size-7 rounded-lg bg-gold-soft text-gold grid place-items-center">
          <Sparkle size={14} weight="fill" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-none">AI agent</p>
          <p className="text-[12px] text-muted mt-1 truncate">Knows your plan, sources & draft</p>
        </div>
        {busy && status ? <span className="ml-auto truncate text-[11.5px] text-muted max-w-[40%]">{status}</span> : null}
      </header>

      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !busy ? (
          <div className="text-[13px] text-ink-soft leading-relaxed">
            <p>I can draft from the plan, rewrite a paragraph, suggest citations, or leave a comment. I never change the essay until you accept a suggestion.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    if (s.label === 'Draft this section' && cursorSection) {
                      void send(`Write section “${cursorSection.title}” (${cursorSection.id}) from the plan. Use insert_paragraph for each paragraph, in order, assigned to that section. Cite sources in APA.`)
                    } else if (s.label === 'Improve selection' && heldSelection?.text) {
                      void send(
                        `Improve this selected text: clearer, tighter, still in the same voice. Propose an edit.\n\n"""${heldSelection.text}"""`,
                      )
                    } else {
                      void send(s.prompt)
                    }
                  }}
                  className="rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] hover:border-gold hover:bg-accent-soft hover:text-gold-ink"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) => (
          <div key={m.id} className={cx('text-[13px] leading-relaxed whitespace-pre-wrap fade-in flex', m.role === 'user' ? 'justify-end' : '')}>
            <div className={cx('rounded-2xl px-3.5 py-2.5 max-w-[95%]', m.role === 'user' ? 'bg-gold-soft' : 'bg-paper')}>{m.content || (busy ? '' : '')}</div>
          </div>
        ))}

        {busy ? <Dots label={status ?? 'Working'} /> : null}
        {error ? <ErrorNote message={error} onRetry={() => lastPrompt && void send(lastPrompt)} /> : null}

        {suggestions.length ? (
          <div className="rounded-md border border-line bg-paper p-2 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-wide text-muted">
                {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}
              </span>
              <span className="flex gap-1">
                <button type="button" onClick={acceptAll} className="text-[12px] text-ins hover:underline">
                  Accept all
                </button>
                <button type="button" onClick={rejectAll} className="text-[12px] text-del hover:underline">
                  Reject all
                </button>
              </span>
            </div>
            {suggestions.map((s) => (
              <div key={s.id} className="rounded border border-line bg-surface px-2 py-1.5">
                <p className="text-[12.5px] font-medium">{s.label}</p>
                <p className="text-[12px] text-muted truncate">{s.newText}</p>
                <div className="mt-1.5 flex gap-1">
                  <Button size="sm" variant="primary" onClick={() => resolve(s, 'accept')}>
                    <Check size={12} weight="bold" />
                    Accept
                  </Button>
                  <Button size="sm" onClick={() => resolve(s, 'reject')}>
                    <X size={12} />
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => iterate(s)}>
                    Iterate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 p-3 border-t border-line">
        {heldSelection?.text ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl bg-accent-soft px-2.5 py-1.5 text-[12px] text-ink-soft">
            <span className="flex-1 min-w-0 line-clamp-2">Using marked text: “{heldSelection.text}”</span>
            <button
              type="button"
              aria-label="Clear marked text"
              onClick={clearHeldSelection}
              className="shrink-0 p-0.5 rounded text-muted hover:text-ink"
            >
              <X size={12} />
            </button>
          </div>
        ) : null}
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
            rows={Math.min(4, Math.max(1, draft.split('\n').length))}
            placeholder={heldSelection?.text ? 'Ask about the marked text…' : 'Ask the agent, or describe an edit…'}
            className="flex-1 resize-none bg-transparent text-[13px] outline-none placeholder:text-muted/70"
            disabled={busy}
          />
          {busy ? (
            <button type="button" onClick={stop} aria-label="Stop" className="size-8 rounded-lg bg-ink text-white grid place-items-center">
              <Stop size={12} weight="fill" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              aria-label="Send"
              className="size-8 rounded-lg bg-gold text-ink grid place-items-center disabled:opacity-40"
            >
              <ArrowUp size={14} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
