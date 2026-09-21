'use client'

import { useMemo } from 'react'
import { Check } from '@phosphor-icons/react/dist/csr/Check'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { useProject } from '@/lib/store'
import { newId } from '@/lib/ids'
import { scrollToParagraph } from '@/editor/commands'
import { cx } from '../ui'
import { useEssayEditorContext } from './EditorContext'

export function CommentRail() {
  const comments = useProject((s) => s.comments)
  const activeCommentId = useProject((s) => s.activeCommentId)
  const setActiveComment = useProject((s) => s.setActiveComment)
  const updateComment = useProject((s) => s.updateComment)
  const removeComment = useProject((s) => s.removeComment)
  const requestAgent = useProject((s) => s.requestAgent)
  const editor = useEssayEditorContext()

  const open = useMemo(() => comments.filter((c) => !c.resolved), [comments])
  if (!open.length) return null

  return (
    <div className="py-4 px-3 space-y-3">
      <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted">Comments</p>
      {open.map((comment) => {
        const active = comment.id === activeCommentId
        return (
          <article
            key={comment.id}
            onClick={() => {
              setActiveComment(comment.id)
              if (editor) scrollToParagraph(editor, comment.paragraphId)
            }}
            className={cx(
              'rounded-md border bg-surface p-3 shadow-soft cursor-pointer fade-in',
              active ? 'border-accent' : 'border-line',
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                {comment.author === 'agent' ? 'Agent' : 'You'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  updateComment(comment.id, { resolved: true })
                  if (activeCommentId === comment.id) setActiveComment(null)
                }}
                className="text-muted hover:text-ins p-0.5"
                aria-label="Resolve"
                title="Resolve"
              >
                <Check size={13} />
              </button>
            </div>
            {comment.quote ? (
              <p className="text-[12px] text-muted italic border-l-2 border-comment pl-2 mb-1.5">“{comment.quote}”</p>
            ) : null}
            <p className="text-[13px] leading-relaxed">{comment.text}</p>
            {comment.replies.map((r) => (
              <p key={r.id} className="mt-2 text-[12.5px] text-ink-soft">
                <span className="font-medium">{r.author === 'agent' ? 'Agent' : 'You'}: </span>
                {r.text}
              </p>
            ))}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="text-[12px] text-accent hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  const reply = window.prompt('Reply')
                  if (!reply?.trim()) return
                  updateComment(comment.id, {
                    replies: [
                      ...comment.replies,
                      { id: newId('r'), author: 'student', text: reply.trim(), createdAt: Date.now() },
                    ],
                  })
                }}
              >
                Reply
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  requestAgent({
                    paragraphId: comment.paragraphId,
                    prompt: `Fix this comment on paragraph ${comment.paragraphId}${comment.quote ? ` (quote: “${comment.quote}”)` : ''}: ${comment.text}. Propose an edit.`,
                  })
                }}
              >
                <Sparkle size={11} weight="fill" />
                Fix this
              </button>
              <button
                type="button"
                className="ml-auto text-[12px] text-muted hover:text-del"
                onClick={(e) => {
                  e.stopPropagation()
                  removeComment(comment.id)
                }}
              >
                Delete
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
