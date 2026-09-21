'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { X } from '@phosphor-icons/react/dist/csr/X'
import { Button, Dots, EmptyState, ErrorNote, Pill, Card, cx } from '../ui'
import { useProject } from '@/lib/store'
import { paragraphsOf } from '@/lib/doc'
import { contextPayload, planPayload, sourcesPayload } from '@/lib/payload'
import { postJSON } from '@/lib/sse'
import type { CitationVerdict, FinalCheckReport } from '@/lib/model'

export function CheckDialog({ onClose }: { onClose: () => void }) {
  const context = useProject((s) => s.context)
  const sources = useProject((s) => s.sources)
  const plan = useProject((s) => s.plan)
  const doc = useProject((s) => s.doc)
  const title = useProject((s) => s.title)
  const report = useProject((s) => s.report)
  const setReport = useProject((s) => s.setReport)
  const requestAgent = useProject((s) => s.requestAgent)
  const setPendingScroll = useProject((s) => s.setPendingScroll)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const paragraphs = paragraphsOf(doc, sources)
      const words = paragraphs.reduce((n, p) => n + (p.text.trim() ? p.text.trim().split(/\s+/).length : 0), 0)
      const result = await postJSON<FinalCheckReport>('/api/check', {
        context: contextPayload(context),
        sources: sourcesPayload(sources, { text: true }),
        plan: planPayload(plan),
        paragraphs,
        title,
        words,
      })
      setReport(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const jump = (paragraphId: string) => {
    setPendingScroll(paragraphId)
    onClose()
  }

  const fix = (paragraphId: string, problem: string) => {
    requestAgent({
      paragraphId,
      prompt: `Fix this problem in paragraph ${paragraphId}: ${problem}. Propose an edit.`,
    })
    onClose()
  }

  return (
    <>
      <div className="no-print fixed inset-0 z-[60] bg-ink/30" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="check-title"
        aria-modal="true"
        className="no-print fixed z-[70] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(880px,calc(100vw-48px))] max-h-[min(860px,calc(100vh-48px))] overflow-y-auto rounded-2xl border border-line bg-surface shadow-page p-6 fade-in"
      >
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h2 id="check-title" className="font-serif text-[26px] font-semibold tracking-[-0.02em] text-ink leading-none">
              Final check
            </h2>
            <p className="text-[14px] text-muted mt-2.5 max-w-[56ch] leading-relaxed">
              A full quality report on facts, sources, coverage and grading — run on demand.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {report ? (
              <Button size="sm" onClick={run} loading={busy} disabled={!context.task.trim()}>
                <ArrowClockwise size={15} weight="bold" />
                Re-run
              </Button>
            ) : (
              <Button size="sm" variant="primary" loading={busy} onClick={run} disabled={!context.task.trim()}>
                Run quality report
              </Button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-black/5">
              <X size={16} />
            </button>
          </div>
        </div>

        {busy ? (
          <div className="py-12 flex justify-center">
            <Dots label="Reading the essay against your sources and the plan" />
          </div>
        ) : null}

        {error ? <div className="mb-4"><ErrorNote message={error} onRetry={run} /></div> : null}

        {!report && !busy ? (
          <EmptyState
            title="No report yet"
            body="Run the check when you have a draft. Each problem can be sent to the agent as a suggestion."
          />
        ) : null}

        {report && !busy ? <ReportView report={report} onJump={jump} onFix={fix} /> : null}
      </div>
    </>
  )
}

function ReportView({
  report,
  onJump,
  onFix,
}: {
  report: FinalCheckReport
  onJump: (id: string) => void
  onFix: (id: string, problem: string) => void
}) {
  const plan = useProject((s) => s.plan)
  const target = report.length.target
  const reviewCount =
    (report.counts.facts?.bad ?? 0) +
    (report.counts.facts?.warn ?? 0) +
    (report.counts.citations?.bad ?? 0) +
    (report.counts.citations?.warn ?? 0) +
    (report.counts.missing?.bad ?? report.missingCitations.length) +
    (report.counts.coverage?.bad ?? 0)

  return (
    <div className="space-y-5 fade-in">
      <Card className="p-6">
        <div className="flex items-start gap-5">
          <span className="font-serif text-[32px] font-semibold tabular-nums leading-none text-ink w-10 text-center">
            {reviewCount}
          </span>
          <div>
            <p className="text-[18px] font-semibold tracking-[-0.01em]">
              {reviewCount ? `Almost there — ${reviewCount} item${reviewCount === 1 ? '' : 's'} to review` : 'Ready to export'}
            </p>
            <p className="text-[14px] text-muted mt-1 leading-relaxed">{report.summary}</p>
          </div>
        </div>
        <div className="mt-6 pt-5 border-t border-line grid grid-cols-5 gap-4">
          <StatDot label="Supported" value={report.counts.facts?.ok ?? 0} tone="ok" />
          <StatDot label="Weak" value={report.counts.facts?.warn ?? 0} tone="warn" />
          <StatDot label="Unsupported" value={report.counts.facts?.bad ?? 0} tone="bad" />
          <StatDot label="Missing citations" value={report.missingCitations.length} tone="warn" />
          <StatDot
            label="Length"
            value={
              target
                ? `${Math.round((report.length.words / target) * 100)}%`
                : report.length.words.toLocaleString()
            }
            tone="ok"
          />
        </div>
      </Card>

      <Accordion
        title="Factual correctness"
        badge={
          report.counts.facts?.bad
            ? `${report.counts.facts.bad} unsupported`
            : report.counts.facts?.warn
              ? `${report.counts.facts.warn} weak`
              : 'Looks solid'
        }
        tone={report.counts.facts?.bad ? 'bad' : report.counts.facts?.warn ? 'warn' : 'ok'}
      >
        {report.facts.length ? (
          <ul className="divide-y divide-line">
            {report.facts.map((f) => (
              <li key={f.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <VerdictPill value={f.verdict} />
                </div>
                <p className="text-[14px]">{f.claim}</p>
                {f.passage ? (
                  <div className="mt-2 rounded-lg bg-paper px-3 py-2 text-[12.5px] text-ink-soft">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted mr-2">Source</span>
                    {f.passage.slice(0, 220)}
                  </div>
                ) : null}
                <RowActions
                  onJump={() => onJump(f.paragraphId)}
                  onFix={
                    f.verdict !== 'supported'
                      ? () => onFix(f.paragraphId, `The claim “${f.claim}” is ${f.verdict}.`)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-[13px] text-muted">No distinct factual claims were extracted.</p>
        )}
      </Accordion>

      <Accordion
        title="Answering the question"
        badge={report.answersQuestion.verdict}
        tone="ok"
      >
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Strongest</p>
            <p className="text-[14px] mt-1">{report.answersQuestion.strongest}</p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Weakest</p>
            <p className="text-[14px] mt-1">{report.answersQuestion.weakest}</p>
          </div>
        </div>
      </Accordion>

      <Accordion title="Citations" badge={`${report.citations.length} checked`} tone={report.counts.citations?.bad ? 'bad' : 'ok'}>
        {report.citations.length ? (
          <ul className="divide-y divide-line">
            {report.citations.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <CitePill verdict={c.verdict} />
                <p className="text-[14px] text-ink-soft mt-2">{c.sentence.slice(0, 220)}</p>
                <RowActions
                  onJump={() => onJump(c.paragraphId)}
                  onFix={
                    c.verdict !== 'fits'
                      ? () => onFix(c.paragraphId, `Citation does not fit: ${c.sentence.slice(0, 120)}`)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-[13px] text-muted">No citations in the essay yet.</p>
        )}
      </Accordion>

      {report.missingCitations.length ? (
        <Accordion title="Missing citations" badge={`${report.missingCitations.length}`} tone="warn">
          <ul className="divide-y divide-line">
            {report.missingCitations.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <p className="text-[14px]">{m.claim}</p>
                <RowActions onJump={() => onJump(m.paragraphId)} onFix={() => onFix(m.paragraphId, `This claim needs a source: ${m.claim}`)} />
              </li>
            ))}
          </ul>
        </Accordion>
      ) : null}

      <Accordion title="Plan coverage" badge={`${report.planCoverage.length} sections`} tone="ok">
        <ul className="divide-y divide-line">
          {report.planCoverage.map((c) => {
            const node = plan.find((n) => n.id === c.sectionId)
            return (
              <li key={c.sectionId} className="px-5 py-4 flex items-start gap-3">
                <Pill tone={c.status === 'covered' ? 'ok' : c.status === 'partial' ? 'warn' : 'bad'}>{c.status}</Pill>
                <div>
                  <p className="text-[14px] font-medium">{node?.title ?? c.sectionId}</p>
                  <p className="text-[13px] text-muted mt-0.5">{c.note}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </Accordion>

      {report.grading.length ? (
        <Accordion title="Grading scheme" badge={`${report.grading.length} criteria`} tone="ok">
          <ul className="divide-y divide-line">
            {report.grading.map((g, i) => (
              <li key={i} className="px-5 py-4">
                <p className="text-[14px] font-medium">{g.criterion}</p>
                <p className="text-[13.5px] text-ink-soft mt-0.5">{g.verdict}</p>
              </li>
            ))}
          </ul>
        </Accordion>
      ) : null}
    </div>
  )
}

function Accordion({
  title,
  badge,
  tone,
  children,
}: {
  title: string
  badge: string
  tone: 'ok' | 'warn' | 'bad'
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-paper/60"
      >
        <span className={cx('text-[15px]', tone === 'ok' ? 'text-ins' : tone === 'warn' ? 'text-warn' : 'text-del')}>
          {tone === 'ok' ? '✓' : tone === 'warn' ? '◎' : '!'}
        </span>
        <span className="text-[16px] font-semibold flex-1">{title}</span>
        <Pill tone={tone}>{badge}</Pill>
        <span className={cx('text-muted text-[18px] transition-transform', open && 'rotate-180')}>⌄</span>
      </button>
      {open ? <div className="border-t border-line">{children}</div> : null}
    </Card>
  )
}

function StatDot({ label, value, tone }: { label: string; value: string | number; tone: 'ok' | 'warn' | 'bad' }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span
          className={cx(
            'size-[7px] rounded-full',
            tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-del',
          )}
        />
        <span className="font-serif text-[22px] font-semibold tabular-nums leading-none">{value}</span>
      </div>
      <p className="text-[12px] text-muted mt-1.5">{label}</p>
    </div>
  )
}

function VerdictPill({ value }: { value: 'supported' | 'weak' | 'unsupported' }) {
  const tone = value === 'supported' ? 'ok' : value === 'weak' ? 'warn' : 'bad'
  return <Pill tone={tone}>{value}</Pill>
}

function CitePill({ verdict }: { verdict: CitationVerdict }) {
  const tone = verdict === 'fits' ? 'ok' : verdict === 'weak' ? 'warn' : 'bad'
  const label = verdict === 'fits' ? 'fits' : verdict === 'weak' ? 'weak' : 'doesn’t fit'
  return <Pill tone={tone}>{label}</Pill>
}

function RowActions({ onJump, onFix }: { onJump: () => void; onFix?: () => void }) {
  return (
    <div className="mt-3 flex gap-2">
      {onFix ? (
        <Button size="sm" onClick={onFix}>
          <Sparkle size={12} weight="fill" />
          Fix with AI
        </Button>
      ) : null}
      <button type="button" onClick={onJump} className="h-8 px-2 text-[12.5px] text-muted hover:text-ink">
        View in draft
      </button>
    </div>
  )
}
