'use client'

import { useState } from 'react'
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown'
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp'
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { Trash } from '@phosphor-icons/react/dist/csr/Trash'
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { Card, Select, cx } from '../ui'
import { useProject } from '@/lib/store'
import type { Evidence, PlanNode } from '@/lib/model'
import { newId } from '@/lib/ids'
import { inTextCitation } from '@/lib/apa'

export function PlanCard({ node, index, total }: { node: PlanNode; index: number; total: number }) {
  const updateNode = useProject((s) => s.updateNode)
  const removeNode = useProject((s) => s.removeNode)
  const moveNode = useProject((s) => s.moveNode)
  const addNode = useProject((s) => s.addNode)
  const sources = useProject((s) => s.sources)
  const [open, setOpen] = useState(true)

  const flagFor = (evidenceId: string) => node.flags.find((f) => f.evidenceId === evidenceId)
  const otherFlags = node.flags.filter((f) => !f.evidenceId)

  const setEvidence = (evidence: Evidence[]) => updateNode(node.id, { evidence })

  return (
    <Card className={cx('overflow-hidden', node.flags.length > 0 && 'border-warn/40')}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="size-6 shrink-0 rounded-full bg-accent-soft text-accent grid place-items-center text-[11.5px] font-semibold tabular-nums">
          {index + 1}
        </span>
        <input
          value={node.title}
          onChange={(e) => updateNode(node.id, { title: e.target.value })}
          aria-label="Section title"
          className="flex-1 min-w-0 bg-transparent text-[15px] font-semibold outline-none rounded px-1 -mx-1 focus:bg-paper"
          placeholder="Section title"
        />
        {node.flags.length ? (
          <span className="inline-flex items-center gap-1 text-warn text-[12px]">
            <WarningCircle size={15} weight="fill" />
            {node.flags.length}
          </span>
        ) : null}
        <input
          type="number"
          value={node.targetWords ?? ''}
          onChange={(e) => updateNode(node.id, { targetWords: e.target.value ? Number(e.target.value) : null })}
          aria-label="Target words"
          placeholder="words"
          className="w-[72px] bg-transparent text-right text-[12.5px] text-muted tabular-nums outline-none rounded px-1 focus:bg-paper"
        />
        <div className="flex items-center text-muted">
          <IconButton label="Move up" disabled={index === 0} onClick={() => moveNode(node.id, -1)}>
            <ArrowUp size={14} />
          </IconButton>
          <IconButton label="Move down" disabled={index === total - 1} onClick={() => moveNode(node.id, 1)}>
            <ArrowDown size={14} />
          </IconButton>
          <IconButton
            label="Add section below"
            onClick={() =>
              addNode(
                {
                  id: newId('sec'),
                  title: 'New section',
                  claim: '',
                  keyPoints: [],
                  evidence: [],
                  targetWords: null,
                  flags: [],
                },
                index + 1,
              )
            }
          >
            <Plus size={14} />
          </IconButton>
          <IconButton label="Delete section" onClick={() => removeNode(node.id)} danger>
            <Trash size={14} />
          </IconButton>
          <IconButton label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen((v) => !v)}>
            <CaretDown size={14} className={cx('transition-transform', !open && '-rotate-90')} />
          </IconButton>
        </div>
      </div>

      {open ? (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-line">
          <Block label="Claim">
            <AutoTextarea
              value={node.claim}
              onChange={(v) => updateNode(node.id, { claim: v })}
              placeholder="One or two sentences stating what this section argues"
            />
          </Block>

          <Block label="Key points" hint="One per line">
            <AutoTextarea
              value={node.keyPoints.join('\n')}
              onChange={(v) => updateNode(node.id, { keyPoints: v.split('\n') })}
              onBlur={() => updateNode(node.id, { keyPoints: node.keyPoints.map((k) => k.trim()).filter(Boolean) })}
              placeholder="Points to make in this section"
              mono
            />
          </Block>

          <Block label="Evidence" hint="Each item linked to a source">
            <ul className="space-y-2">
              {node.evidence.map((e) => {
                const flag = flagFor(e.id)
                return (
                  <li key={e.id} className={cx('rounded-md border p-2', flag ? 'border-warn/40 bg-warn-bg/40' : 'border-line')}>
                    <div className="flex items-start gap-2">
                      <AutoTextarea
                        value={e.text}
                        onChange={(v) => setEvidence(node.evidence.map((x) => (x.id === e.id ? { ...x, text: v } : x)))}
                        placeholder="Fact or quote"
                        className="flex-1"
                      />
                      <button
                        type="button"
                        aria-label="Remove evidence"
                        className="text-muted hover:text-ink p-1"
                        onClick={() => setEvidence(node.evidence.filter((x) => x.id !== e.id))}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Select
                        value={e.sourceId ?? ''}
                        onChange={(ev) =>
                          setEvidence(node.evidence.map((x) => (x.id === e.id ? { ...x, sourceId: ev.target.value || null } : x)))
                        }
                        className="h-7 py-0 text-[12px] w-auto max-w-[320px]"
                      >
                        <option value="">No source</option>
                        {sources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {inTextCitation(s)} {s.title.slice(0, 50)}
                          </option>
                        ))}
                      </Select>
                      {flag ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-warn">
                          <WarningCircle size={13} weight="fill" />
                          {flag.message}
                        </span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className="mt-2 text-[12.5px] text-accent hover:underline"
              onClick={() => setEvidence([...node.evidence, { id: newId('ev'), text: '', sourceId: sources[0]?.id ?? null }])}
            >
              + Add evidence
            </button>
          </Block>

          {otherFlags.length ? (
            <ul className="space-y-1">
              {otherFlags.map((f) => (
                <li key={f.id} className="flex items-center gap-1.5 text-[12.5px] text-warn">
                  <WarningCircle size={14} weight="fill" />
                  {f.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

function Block({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
        {hint ? <span className="text-[11.5px] text-muted/80">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx('p-1.5 rounded hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent', danger && 'hover:text-del')}
    >
      {children}
    </button>
  )
}

export function AutoTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  mono,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  mono?: boolean
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={Math.max(1, Math.min(8, value.split('\n').length))}
      className={cx(
        'w-full resize-none bg-transparent text-[13px] leading-relaxed text-ink outline-none rounded px-1 -mx-1 focus:bg-paper placeholder:text-muted/70',
        mono && 'whitespace-pre-wrap',
        className,
      )}
    />
  )
}
