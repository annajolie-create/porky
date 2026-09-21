import 'server-only'

import { MODELS, chatStream, type ChatMessage, type ToolCall, type ToolDefinition } from './openrouter'
import { PROMPTS, contextBlock, planBlock, sourcesBlock } from './prompts'
import type { ContextInput, PlanInput, SourceInput } from './prompts'

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_outline',
      description: 'Read the essay outline: sections, paragraph ids and the first line of each paragraph. Start here.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_section',
      description: 'Read every paragraph in a plan section in full.',
      parameters: {
        type: 'object',
        properties: { sectionId: { type: 'string' } },
        required: ['sectionId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_paragraphs',
      description: 'Read specific paragraphs in full, by id.',
      parameters: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' } } },
        required: ['ids'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_edit',
      description:
        'Suggest a full rewrite of one existing paragraph. The student will see a red/green diff and must accept it. Return the complete new paragraph, not a fragment. Include APA in-text citations exactly as listed in the source list.',
      parameters: {
        type: 'object',
        properties: {
          paragraphId: { type: 'string' },
          newText: { type: 'string' },
          label: { type: 'string', description: 'Short label, e.g. "Tightened paragraph".' },
        },
        required: ['paragraphId', 'newText'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'insert_paragraph',
      description:
        'Suggest a new paragraph. Place it after afterParagraphId (omit or null to insert at the start). Assign it to sectionId from the plan.',
      parameters: {
        type: 'object',
        properties: {
          afterParagraphId: { type: ['string', 'null'] },
          sectionId: { type: ['string', 'null'] },
          text: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_comment',
      description: 'Leave a Google Docs-style comment on a paragraph, optionally quoting a short span.',
      parameters: {
        type: 'object',
        properties: {
          paragraphId: { type: 'string' },
          quote: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['paragraphId', 'text'],
        additionalProperties: false,
      },
    },
  },
]

export type AgentParagraph = { id: string; sectionId: string | null; text: string }

export type AgentBody = {
  messages: { role: 'user' | 'assistant'; content: string }[]
  context: ContextInput
  sources: SourceInput[]
  plan: PlanInput
  paragraphs: AgentParagraph[]
  title?: string
  selection?: { text: string; paragraphIds: string[] }
}

export type AgentProposal =
  | { kind: 'edit'; paragraphId: string; newText: string; label: string }
  | { kind: 'insert'; afterParagraphId: string | null; sectionId: string | null; text: string; label: string }

export type AgentComment = { paragraphId: string; quote: string; text: string }

function outline(paragraphs: AgentParagraph[], plan: PlanInput): string {
  const bySection = new Map<string | null, AgentParagraph[]>()
  for (const p of paragraphs) {
    if (!p.text.trim()) continue
    const list = bySection.get(p.sectionId) ?? []
    list.push(p)
    bySection.set(p.sectionId, list)
  }
  const titleOf = (id: string | null) => plan.find((n) => n.id === id)?.title ?? '(unassigned)'
  const parts: string[] = []
  for (const [sectionId, list] of bySection) {
    parts.push(`Section "${titleOf(sectionId)}" [${sectionId ?? 'none'}]:`)
    for (const p of list) {
      const first = p.text.replace(/\s+/g, ' ').trim().slice(0, 90)
      parts.push(`  - ${p.id} (${p.text.trim().split(/\s+/).length}w): ${first}`)
    }
  }
  return parts.join('\n') || '(The essay is empty.)'
}

function executeTool(
  name: string,
  args: Record<string, unknown>,
  body: AgentBody,
): { result: string; proposal?: AgentProposal; comment?: AgentComment; status?: string } {
  const paragraphs = body.paragraphs
  if (name === 'read_outline') {
    return { result: outline(paragraphs, body.plan), status: 'Reading outline' }
  }
  if (name === 'read_section') {
    const sectionId = String(args.sectionId ?? '')
    const title = body.plan.find((n) => n.id === sectionId)?.title ?? sectionId
    const list = paragraphs.filter((p) => p.sectionId === sectionId)
    const result = list.length
      ? list.map((p) => `<p id="${p.id}">${p.text}</p>`).join('\n\n')
      : '(No paragraphs in this section.)'
    return { result, status: `Reading section “${title}”` }
  }
  if (name === 'read_paragraphs') {
    const ids = Array.isArray(args.ids) ? args.ids.map(String) : []
    const list = paragraphs.filter((p) => ids.includes(p.id))
    const result = list.length
      ? list.map((p) => `<p id="${p.id}">${p.text}</p>`).join('\n\n')
      : '(Those paragraphs were not found.)'
    return { result, status: `Reading ${list.length || ids.length} paragraph${list.length === 1 ? '' : 's'}` }
  }
  if (name === 'propose_edit') {
    const paragraphId = String(args.paragraphId ?? '')
    const newText = String(args.newText ?? '').trim()
    if (!paragraphId || !newText) return { result: 'Need paragraphId and newText.' }
    const existing = paragraphs.find((p) => p.id === paragraphId)
    if (!existing) return { result: `No paragraph with id ${paragraphId}.` }
    const label = String(args.label ?? 'Rewrite')
    return {
      result: 'Suggestion shown to the student. Do not paste the new text in the chat.',
      proposal: { kind: 'edit', paragraphId, newText, label },
      status: `Proposing an edit to ${paragraphId}`,
    }
  }
  if (name === 'insert_paragraph') {
    const text = String(args.text ?? '').trim()
    if (!text) return { result: 'Need text for the new paragraph.' }
    const afterParagraphId = args.afterParagraphId ? String(args.afterParagraphId) : null
    const sectionId = args.sectionId ? String(args.sectionId) : null
    const label = String(args.label ?? 'New paragraph')
    return {
      result: 'Insertion shown to the student. Do not paste the paragraph in the chat.',
      proposal: { kind: 'insert', afterParagraphId, sectionId, text, label },
      status: 'Proposing a new paragraph',
    }
  }
  if (name === 'add_comment') {
    const paragraphId = String(args.paragraphId ?? '')
    const text = String(args.text ?? '').trim()
    if (!paragraphId || !text) return { result: 'Need paragraphId and text.' }
    return {
      result: 'Comment added.',
      comment: { paragraphId, quote: String(args.quote ?? ''), text },
      status: 'Leaving a comment',
    }
  }
  return { result: `Unknown tool ${name}.` }
}

export async function runAgent(
  body: AgentBody,
  emit: (event: string, data: unknown) => void,
  signal: AbortSignal,
) {
  const system = [
    PROMPTS.agent,
    '',
    `Essay title: ${body.title?.trim() || '(untitled)'}`,
    contextBlock(body.context),
    planBlock(body.plan),
    sourcesBlock(body.sources, { includeText: false }),
    '',
    'Current outline (first lines only; open a section or paragraph to read more):',
    outline(body.paragraphs, body.plan),
  ].join('\n')

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...body.messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
  ]

  if (body.selection?.text) {
    const last = messages[messages.length - 1]
    if (last && last.role === 'user' && typeof last.content === 'string') {
      last.content += `\n\n<selection paragraphs="${(body.selection.paragraphIds ?? []).join(',')}">\n${body.selection.text}\n</selection>`
    }
  }

  emit('status', { text: 'Thinking' })

  for (let round = 0; round < 8; round++) {
    if (signal.aborted) return
    let toolCalls: ToolCall[] = []
    let text = ''

    for await (const event of chatStream({
      model: MODELS.strong,
      messages,
      tools: AGENT_TOOLS,
      maxTokens: 4000,
      temperature: 0.4,
      signal,
    })) {
      if (event.type === 'text') {
        text += event.text
        emit('delta', { text: event.text })
      } else if (event.type === 'tool_calls') {
        toolCalls = event.toolCalls
      }
    }

    if (!toolCalls.length) {
      emit('done', { text })
      return
    }

    messages.push({
      role: 'assistant',
      content: text || null,
      tool_calls: toolCalls,
    })

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
      } catch {
        args = {}
      }
      const executed = executeTool(call.function.name, args, body)
      if (executed.status) emit('status', { text: executed.status })
      if (executed.proposal) emit('proposal', executed.proposal)
      if (executed.comment) emit('comment', executed.comment)
      messages.push({ role: 'tool', tool_call_id: call.id, content: executed.result })
    }
  }

  emit('done', { text: '' })
}
