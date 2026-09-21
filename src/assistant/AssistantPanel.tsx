import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp'
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise'
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { Stop } from '@phosphor-icons/react/dist/csr/Stop'
import { TextIndent } from '@phosphor-icons/react/dist/csr/TextIndent'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { Markdown } from './Markdown'
import { useAssistant } from './useAssistant'
import type { DocumentSnapshot } from './useAssistant'

const QUICK_ACTIONS = [
  { label: 'Summarise', prompt: 'Summarise this document in three sentences.' },
  {
    label: 'Tighten',
    prompt:
      'Tighten the selected text if there is a selection, otherwise the whole document. Cut filler, keep the argument and the voice. Return only the rewritten prose.',
  },
  {
    label: 'Critique',
    prompt:
      'Read this as a sceptical editor. Name the three weakest points, quoting the exact phrase for each, and say what would fix it.',
  },
  {
    label: 'Continue',
    prompt:
      'Continue the document from where it stops, in the same voice, for one or two paragraphs. Return only the new prose.',
  },
]

export function AssistantPanel({
  onClose,
  getSnapshot,
  onInsert,
}: {
  onClose: () => void
  getSnapshot: () => DocumentSnapshot
  onInsert: (text: string) => void
}) {
  const { messages, streaming, error, send, stop, clear } = useAssistant()
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(null), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  const submit = (prompt: string) => {
    if (streaming) return
    void send(prompt, getSnapshot())
    setDraft('')
    // Reset the grown textarea back to one row.
    if (field.current) field.current.style.height = 'auto'
  }

  return (
    <aside className="assistant" aria-label="Writing assistant">
      <header className="assistant-head">
        <span className="assistant-title">
          <Sparkle size={15} weight="fill" />
          Assistant
          <span className="assistant-model">Haiku 4.5</span>
        </span>
        <span className="assistant-head-actions">
          {messages.length ? (
            <button
              type="button"
              className="tool-btn"
              aria-label="New conversation"
              title="New conversation"
              onClick={clear}
            >
              <ArrowsClockwise size={15} weight="bold" />
            </button>
          ) : null}
          <button
            type="button"
            className="tool-btn"
            aria-label="Close assistant"
            title="Close assistant"
            onClick={onClose}
          >
            <X size={15} weight="bold" />
          </button>
        </span>
      </header>

      <div className="assistant-scroll" ref={scroller}>
        {messages.length === 0 ? (
          <div className="assistant-empty">
            <p>
              Ask about the document you are writing. It can see the text, and the part you have
              selected.
            </p>
            <div className="assistant-chips">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="assistant-chip"
                  onClick={() => submit(action.prompt)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`chat chat-${message.role}`}>
              {message.role === 'assistant' ? (
                <>
                  <div className="chat-body">
                    <Markdown text={message.content} />
                    {streaming && !message.content ? <span className="chat-caret" /> : null}
                  </div>
                  {message.content && !streaming ? (
                    <div className="chat-actions">
                      <button
                        type="button"
                        className="chat-action"
                        onClick={() => onInsert(message.content)}
                      >
                        <TextIndent size={13} weight="bold" />
                        Insert
                      </button>
                      <button
                        type="button"
                        className="chat-action"
                        onClick={() => {
                          void navigator.clipboard.writeText(message.content)
                          setCopied(message.id)
                        }}
                      >
                        <ClipboardText size={13} weight="bold" />
                        {copied === message.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="chat-body">{message.content}</div>
              )}
            </div>
          ))
        )}

        {error ? (
          <p className="assistant-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <form
        className="assistant-compose"
        onSubmit={(event) => {
          event.preventDefault()
          submit(draft)
        }}
      >
        <textarea
          ref={field}
          className="assistant-field"
          rows={1}
          value={draft}
          placeholder="Ask about this document"
          aria-label="Message the assistant"
          onChange={(event) => {
            setDraft(event.target.value)
            const element = event.target
            element.style.height = 'auto'
            element.style.height = `${Math.min(element.scrollHeight, 180)}px`
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit(draft)
            }
          }}
        />
        {streaming ? (
          <button type="button" className="assistant-send" aria-label="Stop" title="Stop" onClick={stop}>
            <Stop size={15} weight="fill" />
          </button>
        ) : (
          <button
            type="submit"
            className="assistant-send"
            aria-label="Send"
            title="Send"
            disabled={!draft.trim()}
          >
            <ArrowUp size={15} weight="bold" />
          </button>
        )}
      </form>
    </aside>
  )
}
