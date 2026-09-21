import type { ReactNode } from 'react'

/**
 * Just enough markdown for a chat reply: paragraphs, lists, inline code, bold
 * and italic. Built as React elements rather than injected HTML, so a model
 * response can never introduce markup into the page.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|(?<![*\w])\*[^*\n]+\*(?!\w))/g
  let last = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${index++}`

    if (token.startsWith('`')) nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    else if (token.startsWith('**')) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else nodes.push(<em key={key}>{token.slice(1, -1)}</em>)

    last = match.index + token.length
  }

  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.split('\n')
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    const key = `p-${blocks.length}`
    blocks.push(<p key={key}>{inline(paragraph.join(' '), key)}</p>)
    paragraph = []
  }

  const flushList = () => {
    if (!list) return
    const key = `l-${blocks.length}`
    const items = list.items.map((item, i) => <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>)
    blocks.push(list.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>)
    list = null
  }

  for (const line of lines) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line)

    if (bullet || numbered) {
      flushParagraph()
      const ordered = Boolean(numbered)
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push((bullet ?? numbered)![1])
      continue
    }

    flushList()

    if (heading) {
      flushParagraph()
      const key = `h-${blocks.length}`
      blocks.push(
        <p key={key} className="chat-heading">
          {inline(heading[1], key)}
        </p>,
      )
      continue
    }

    if (!line.trim()) flushParagraph()
    else paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()

  return <>{blocks}</>
}
