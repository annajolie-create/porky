'use client'

import { useState } from 'react'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle'
import { Button, EmptyState, ErrorNote, Pill, SectionHeading, cx } from '../ui'
import { selectContextDrifted, useProject } from '@/lib/store'
import { newId } from '@/lib/ids'
import type { PlanFlag, PlanNode } from '@/lib/model'
import { relevantPassages } from '@/lib/passages'
import { postJSON } from '@/lib/sse'
import { PlanCard } from './PlanCard'
import { KICKOFF, PlanChat, REDO_PLAN_PROMPT } from './PlanChat'

type CheckResult = {
  answersTask: { probability: number }
  evidence: { nodeId: string; evidenceId: string; supported: number }[]
}

export function PlanTab() {
  const plan = useProject((s) => s.plan)
  const sources = useProject((s) => s.sources)
  const context = useProject((s) => s.context)
  const addNode = useProject((s) => s.addNode)
  const setNodeFlags = useProject((s) => s.setNodeFlags)
  const drifted = useProject(selectContextDrifted)
  const requestPlanRevision = useProject((s) => s.requestPlanRevision)
  const acknowledgeContextDrift = useProject((s) => s.acknowledgeContextDrift)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [taskVerdict, setTaskVerdict] = useState<number | null>(null)

  const totalTarget = plan.reduce((sum, n) => sum + (n.targetWords ?? 0), 0)

  const addSection = (index?: number) => {
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
      index,
    )
  }

  const checkPlan = async () => {
    setChecking(true)
    setCheckError(null)
    try {
      const items = plan.flatMap((node) =>
        node.evidence
          .filter((e) => e.sourceId && e.text.trim())
          .map((e) => {
            const source = sources.find((s) => s.id === e.sourceId)
            return {
              nodeId: node.id,
              evidenceId: e.id,
              claim: e.text,
              sourceTitle: source?.title ?? 'Unknown source',
              passages: source ? relevantPassages(source.text, e.text, 4) : [],
            }
          })
          .filter((item) => item.passages.length),
      )
      const planSummary = plan.map((n, i) => `${i + 1}. ${n.title}: ${n.claim}`).join('\n')
      const result = await postJSON<CheckResult>('/api/plan/check', { task: context.task, planSummary, items })

      const flags: Record<string, PlanFlag[]> = {}
      for (const node of plan) flags[node.id] = []
      for (const ev of result.evidence) {
        if (ev.supported < 0.45) {
          const node = plan.find((n) => n.id === ev.nodeId)
          const evidence = node?.evidence.find((e) => e.id === ev.evidenceId)
          flags[ev.nodeId]?.push({
            id: newId('flag'),
            kind: 'evidence',
            evidenceId: ev.evidenceId,
            message: `The linked source does not seem to support: "${evidence?.text.slice(0, 80) ?? ''}"`,
          })
        }
      }
      for (const node of plan) {
        for (const e of node.evidence) {
          if (!e.sourceId && e.text.trim()) {
            flags[node.id].push({ id: newId('flag'), kind: 'evidence', evidenceId: e.id, message: `No source linked: "${e.text.slice(0, 80)}"` })
          }
        }
      }
      setNodeFlags(flags)
      setTaskVerdict(result.answersTask.probability)
    } catch (e) {
      setCheckError((e as Error).message)
    } finally {
      setChecking(false)
    }
  }

  const flagCount = plan.reduce((sum, n) => sum + n.flags.length, 0)

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 px-8 pt-8">
        <SectionHeading
          title="Plan"
          description="The structured argument behind your essay. The AI and the checkers all work from this."
          actions={
            <>
              {plan.length ? (
                <Button onClick={checkPlan} loading={checking}>
                  <ShieldCheck size={15} weight="bold" />
                  Check plan
                </Button>
              ) : null}
              <Button variant="primary" onClick={() => requestPlanRevision(KICKOFF)} disabled={!context.task.trim()}>
                <Sparkle size={15} weight="fill" />
                Create plan with AI
              </Button>
            </>
          }
        />

        {drifted ? (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-warn/40 bg-warn-bg px-4 py-3.5">
            <p className="text-[13.5px] text-ink leading-relaxed">Wait, context has changed. Should we redo the plan?</p>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="primary" onClick={() => requestPlanRevision(REDO_PLAN_PROMPT)}>
                Redo plan
              </Button>
              <Button variant="ghost" onClick={() => acknowledgeContextDrift()}>
                Keep this plan
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(440px,46%)] gap-6 px-8 pb-28">
        <div className="min-w-0 min-h-0 overflow-y-auto pr-1">
          {plan.length ? (
            <>
              <div className="flex items-end justify-between gap-4 mb-3">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted min-w-0">
                  <span>
                    {plan.length} section{plan.length === 1 ? '' : 's'}
                  </span>
                  {taskVerdict !== null ? (
                    <Pill tone={taskVerdict >= 0.6 ? 'ok' : taskVerdict >= 0.4 ? 'warn' : 'bad'}>
                      {taskVerdict >= 0.6 ? 'Answers the task' : taskVerdict >= 0.4 ? 'Partly answers the task' : 'Does not answer the task'}
                    </Pill>
                  ) : null}
                  {flagCount ? <Pill tone="warn">{flagCount} evidence flag{flagCount === 1 ? '' : 's'}</Pill> : null}
                </div>
                <WordBudget allocated={totalTarget} essayTarget={context.lengthWords} />
              </div>
              {checkError ? <div className="mb-4"><ErrorNote message={checkError} onRetry={checkPlan} /></div> : null}
              <div>
                <AddSectionBar onAdd={() => addSection(0)} label="Add section above" />
                {plan.map((node, index) => (
                  <div key={node.id}>
                    <PlanCard node={node} index={index} total={plan.length} />
                    <AddSectionBar onAdd={() => addSection(index + 1)} label="Add section below" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No plan yet"
              body="Ask the assistant on the right to propose one, or add a section by hand."
              action={
                <Button variant="ghost" onClick={() => addSection()}>
                  <Plus size={14} weight="bold" />
                  Add a section by hand
                </Button>
              }
            />
          )}
        </div>

        <div className="min-h-0 min-w-0">
          <PlanChat />
        </div>
      </div>
    </div>
  )
}

function AddSectionBar({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <div className="group relative flex items-center h-8">
      <div className="absolute inset-x-8 h-px bg-line group-hover:bg-line-strong" />
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onAdd}
        className="relative z-[1] mx-auto size-6 grid place-items-center rounded-full border border-line bg-paper text-muted hover:border-gold hover:text-gold-ink hover:bg-gold-soft active:scale-[0.97]"
      >
        <Plus size={12} weight="bold" />
      </button>
    </div>
  )
}

function WordBudget({ allocated, essayTarget }: { allocated: number; essayTarget: number | null }) {
  const over = Boolean(essayTarget && allocated > essayTarget)
  const share = essayTarget ? Math.min(1, allocated / essayTarget) : 0

  return (
    <div className="shrink-0 w-[148px] text-right">
      <div className="flex items-baseline justify-end gap-1.5">
        <span className="font-serif text-[18px] font-semibold tabular-nums leading-none text-ink">
          {allocated.toLocaleString()}
        </span>
        {essayTarget ? (
          <span className="text-[12px] text-muted tabular-nums">/ {essayTarget.toLocaleString()}</span>
        ) : (
          <span className="text-[12px] text-muted">words</span>
        )}
      </div>
      {essayTarget ? (
        <div className="mt-1.5 h-[3px] rounded-full bg-line overflow-hidden">
          <div
            className={cx('h-full rounded-full', over ? 'bg-warn' : 'bg-gold')}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

export type { PlanNode }
