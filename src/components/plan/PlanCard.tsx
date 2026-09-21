'use client'

import { useState } from 'react'
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown'
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp'
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown'
import { Trash } from '@phosphor-icons/react/dist/csr/Trash'
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { Card, cx } from '../ui'
import { Dropdown } from '../Menu'
import { useProject } from '@/lib/store'
import type { Evidence, PlanNode } from '@/lib/model'
import { newId } from '@/lib/ids'
import { inTextCitation } from '@/lib/apa'

export function PlanCard({ node, index, total }: { node: PlanNode; index: number; total: number }) {
  const updateNode = useProject((s) => s.updateNode)
  const removeNode = useProject((s) => s.removeNode)
  const moveNode = useProject((s) => s.moveNode)
  const essayTarget = useProject((s) => s.context.lengthWords)
  const sources = useProject((s) => s.sources)
  const [open, setOpen] = useState(true)

  const flagFor = (evidenceId: string) => node.flags.find((f) => f.evidenceId === evidenceId)
  const otherFlags = node.flags.filter((f) => !f.evidenceId)

  const setEvidence = (evidence: Evidence[]) => updateNode(node.id, { evidence })

  return (
    <Card className={cx('overflow-hidden', node.flags.length > 0 && 'border-gold/55 ring-1 ring-gold/20')}>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="size-7 shrink-0 rounded-full bg-gold text-ink grid place-items-center text-[13px] font-semibold tabular-nums">
          {index + 1}
        </span>
        <input
          value={node.title}
          onChange={(e) => updateNode(node.id, { title: e.target.value })}
          aria-label="Section title"
          className="flex-1 min-w-0 bg-transparent font-serif text-[20px] font-semibold tracking-[-0.02em] leading-snug outline-none rounded px-1 -mx-1 focus:bg-paper"
          placeholder="Section title"
        />
        <div className="flex items-center gap-2 shrink-0">
          {node.flags.length ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-gold-ink text-[11.5px] font-medium">
              <WarningCircle size={13} weight="fill" />
              {node.flags.length} issue{node.flags.length === 1 ? '' : 's'}
            </span>
          ) : null}
          <WordTarget
            value={node.targetWords}
            essayTarget={essayTarget}
            onChange={(targetWords) => updateNode(node.id, { targetWords })}
          />
          <div className="flex items-center text-muted">
            <IconButton label="Move up" disabled={index === 0} onClick={() => moveNode(node.id, -1)}>
              <ArrowUp size={14} />
            </IconButton>
            <IconButton label="Move down" disabled={index === total - 1} onClick={() => moveNode(node.id, 1)}>
              <ArrowDown size={14} />
            </IconButton>
            <IconButton label="Delete section" onClick={() => removeNode(node.id)} danger>
              <Trash size={14} />
            </IconButton>
            <IconButton label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen((v) => !v)}>
              <CaretDown size={14} className={cx('transition-transform', !open && '-rotate-90')} />
            </IconButton>
          </div>
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

          <Block label="Key points">
            <KeyPointList
              points={node.keyPoints}
              onChange={(keyPoints) => updateNode(node.id, { keyPoints })}
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
                    <div className="w-auto max-w-[320px]">
                      <Dropdown
                        label="Source"
                        size="sm"
                        value={e.sourceId ?? ''}
                        onChange={(sourceId) =>
                          setEvidence(node.evidence.map((x) => (x.id === e.id ? { ...x, sourceId: sourceId || null } : x)))
                        }
                        options={[
                          { value: '', label: 'No source' },
                          ...sources.map((s) => ({
                            value: s.id,
                            label: `${inTextCitation(s)} ${s.title.slice(0, 50)}`,
                          })),
                        ]}
                      />
                    </div>
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

function WordTarget({
  value,
  essayTarget,
  onChange,
}: {
  value: number | null
  essayTarget: number | null
  onChange: (value: number | null) => void
}) {
  const share = value && essayTarget ? Math.min(1, value / essayTarget) : 0
  const over = Boolean(value && essayTarget && value > essayTarget)

  return (
    <label className="flex flex-col items-end justify-center min-w-[56px] px-1">
      <input
        type="number"
        min={0}
        step={50}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label="Target words for this section"
        placeholder="—"
        className="w-[56px] bg-transparent text-right font-serif text-[17px] font-semibold tabular-nums leading-none text-ink outline-none placeholder:text-muted/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="text-[10.5px] text-muted mt-1 leading-none">words</span>
      {essayTarget && value ? (
        <span className="mt-1.5 block h-[2px] w-full rounded-full bg-line overflow-hidden" aria-hidden>
          <span
            className={cx('block h-full rounded-full', over ? 'bg-warn' : 'bg-gold')}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </span>
      ) : null}
    </label>
  )
}

function Block({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
        {hint ? <span className="text-[11.5px] text-muted/80">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

function KeyPointList({ points, onChange }: { points: string[]; onChange: (next: string[]) => void }) {
  const rows = points.length ? points : ['']

  const setRow = (index: number, value: string) => {
    const next = points.length ? [...points] : ['']
    next[index] = value
    onChange(next)
  }

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index)
    onChange(next.map((p) => p.trim()).filter((p, i, all) => p.length > 0 || all.length === 1))
  }

  return (
    <div>
      <ol className="space-y-2">
        {rows.map((point, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-1.5 size-5 shrink-0 rounded-full bg-paper text-gold-ink grid place-items-center text-[11px] font-semibold tabular-nums">
              {i + 1}
            </span>
            <AutoTextarea
              value={point}
              onChange={(v) => setRow(i, v)}
              onBlur={() => onChange(rows.map((p) => p.trim()).filter((p, idx, all) => p.length > 0 || all.length === 1))}
              placeholder={`Key point ${i + 1}`}
              className="flex-1 min-h-[32px] text-[14px] leading-snug py-1"
            />
            <button
              type="button"
              aria-label={`Remove key point ${i + 1}`}
              className="mt-1 p-1 text-muted hover:text-ink rounded"
              onClick={() => removeRow(i)}
              disabled={rows.length === 1 && !point.trim()}
            >
              <X size={13} />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="mt-2 ml-7 text-[12.5px] text-accent hover:underline"
        onClick={() => onChange([...rows, ''])}
      >
        + Add key point
      </button>
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
