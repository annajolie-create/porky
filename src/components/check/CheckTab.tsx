'use client'

import { useState } from 'react'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { TabPage } from '../AppShell'
import { Button, Dots, EmptyState, ErrorNote, Pill, SectionHeading, Card } from '../ui'
import { useProject } from '@/lib/store'
import { paragraphsOf } from '@/lib/doc'
import { contextPayload, planPayload, sourcesPayload } from '@/lib/payload'
import { postJSON } from '@/lib/sse'
import type { CitationVerdict, FinalCheckReport } from '@/lib/model'

export function CheckTab() {
  const context = useProject((s) => s.context)
  const sources = useProject((s) => s.sources)
  const plan = useProject((s) => s.plan)
  const doc = useProject((s) => s.doc)
  const title = useProject((s) => s.title)
  const report = useProject((s) => s.report)
  const setReport = useProject((s) => s.setReport)
  const setTab = useProject((s) => s.setTab)
  const requestAgent = useProject((s) => s.requestAgent)
  const setPendingScroll = useProject((s) => s.setPendingScroll)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setTab('write')
  }

  const fix = (paragraphId: string, problem: string) => {
    requestAgent({
      paragraphId,
      prompt: `Fix this problem in paragraph ${paragraphId}: ${problem}. Propose an edit.`,
    })
  }

  return (
    <TabPage wide>
      <SectionHeading
        title="Final check"
        description="A full quality report: facts, citations, whether you answered the question, and how the essay covers the plan."
        actions={
          <Button variant="primary" loading={busy} onClick={run} disabled={!context.task.trim()}>
            Run quality report
          </Button>
        }
      />

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
    </TabPage>
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
  const over =
    target && report.length.words > target * 1.1 ? 'over' : target && report.length.words < target * 0.85 ? 'under' : 'ok'

  return (
    <div className="space-y-8 fade-in">
      <Card className="p-5">
        <p className="text-[15px] leading-relaxed">{report.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Stat label="Facts" counts={report.counts.facts} />
          <Stat label="Citations" counts={report.counts.citations} />
          <Stat label="Missing cites" counts={report.counts.missing} />
          <Stat label="Plan coverage" counts={report.counts.coverage} />
          <Pill tone={over === 'ok' ? 'ok' : 'warn'}>
            {report.length.words.toLocaleString()}
            {target ? ` / ${target.toLocaleString()}` : ''} words
          </Pill>
        </div>
      </Card>

      <Section title="Answering the question">
        <p className="text-[14px]">{report.answersQuestion.verdict}</p>
        <p className="text-[13px] text-ink-soft mt-2">
          <span className="font-medium text-ink">Strongest: </span>
          {report.answersQuestion.strongest}
        </p>
        <p className="text-[13px] text-ink-soft mt-1">
          <span className="font-medium text-ink">Weakest: </span>
          {report.answersQuestion.weakest}
        </p>
      </Section>

      <Section title="Factual claims">
        {report.facts.length ? (
          <ul className="space-y-2">
            {report.facts.map((f) => (
              <li key={f.id} className="rounded-md border border-line bg-surface p-3">
                <div className="flex items-start gap-2">
                  <VerdictPill value={f.verdict} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px]">{f.claim}</p>
                    {f.passage ? <p className="text-[12.5px] text-muted mt-1">“{f.passage.slice(0, 220)}”</p> : null}
                    <RowActions
                      onJump={() => onJump(f.paragraphId)}
                      onFix={
                        f.verdict !== 'supported'
                          ? () => onFix(f.paragraphId, `The claim “${f.claim}” is ${f.verdict}.`)
                          : undefined
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">No distinct factual claims were extracted.</p>
        )}
      </Section>

      <Section title="Citations">
        {report.citations.length ? (
          <ul className="space-y-2">
            {report.citations.map((c) => (
              <li key={c.id} className="rounded-md border border-line bg-surface p-3 flex items-start gap-2">
                <CitePill verdict={c.verdict} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-ink-soft">{c.sentence.slice(0, 220)}</p>
                  <RowActions
                    onJump={() => onJump(c.paragraphId)}
                    onFix={
                      c.verdict !== 'fits'
                        ? () => onFix(c.paragraphId, `Citation does not fit: ${c.sentence.slice(0, 120)}`)
                        : undefined
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">No citations in the essay yet.</p>
        )}
      </Section>

      {report.missingCitations.length ? (
        <Section title="Missing citations">
          <ul className="space-y-2">
            {report.missingCitations.map((m) => (
              <li key={m.id} className="rounded-md border border-line bg-surface p-3">
                <p className="text-[13.5px]">{m.claim}</p>
                <RowActions onJump={() => onJump(m.paragraphId)} onFix={() => onFix(m.paragraphId, `This claim needs a source: ${m.claim}`)} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Plan coverage">
        <ul className="space-y-2">
          {report.planCoverage.map((c) => {
            const node = plan.find((n) => n.id === c.sectionId)
            return (
              <li key={c.sectionId} className="flex items-start gap-3 rounded-md border border-line bg-surface p-3">
                <Pill tone={c.status === 'covered' ? 'ok' : c.status === 'partial' ? 'warn' : 'bad'}>{c.status}</Pill>
                <div>
                  <p className="text-[13.5px] font-medium">{node?.title ?? c.sectionId}</p>
                  <p className="text-[12.5px] text-muted mt-0.5">{c.note}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </Section>

      {report.grading.length ? (
        <Section title="Grading scheme">
          <ul className="space-y-2">
            {report.grading.map((g, i) => (
              <li key={i} className="rounded-md border border-line bg-surface p-3">
                <p className="text-[13px] font-medium">{g.criterion}</p>
                <p className="text-[13px] text-ink-soft mt-0.5">{g.verdict}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold mb-3">{title}</h2>
      {children}
    </section>
  )
}

function Stat({ label, counts }: { label: string; counts?: { ok: number; warn: number; bad: number } }) {
  if (!counts) return null
  return (
    <Pill tone={counts.bad ? 'bad' : counts.warn ? 'warn' : 'ok'}>
      {label}: {counts.ok} ok · {counts.warn} weak · {counts.bad} fail
    </Pill>
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
    <div className="mt-1.5 flex gap-3">
      <button type="button" onClick={onJump} className="text-[12px] text-muted hover:text-accent">
        Show in essay
      </button>
      {onFix ? (
        <button type="button" onClick={onFix} className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
          <Sparkle size={11} weight="fill" />
          Fix with AI
        </button>
      ) : null}
    </div>
  )
}
