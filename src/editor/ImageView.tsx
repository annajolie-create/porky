import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { AlignCenterHorizontal } from '@phosphor-icons/react/dist/csr/AlignCenterHorizontal'
import { AlignLeft } from '@phosphor-icons/react/dist/csr/AlignLeft'
import { AlignRight } from '@phosphor-icons/react/dist/csr/AlignRight'
import { TrashSimple } from '@phosphor-icons/react/dist/csr/TrashSimple'

const ALIGNMENTS = [
  { id: 'left', label: 'Align left', Icon: AlignLeft },
  { id: 'center', label: 'Centre', Icon: AlignCenterHorizontal },
  { id: 'right', label: 'Align right', Icon: AlignRight },
] as const

const WIDTH_PRESETS = ['25%', '50%', '75%', '100%']
const MIN_PERCENT = 10

export function ImageView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const frame = useRef<HTMLDivElement>(null)
  const width = (node.attrs.width as string | null) ?? '100%'
  const align = (node.attrs.align as string | null) ?? 'center'

  const startResize = (event: ReactPointerEvent<HTMLSpanElement>, edge: 'left' | 'right') => {
    if (!editor.isEditable) return
    const element = frame.current
    const track = element?.parentElement
    if (!element || !track) return

    event.preventDefault()
    event.stopPropagation()

    const available = track.getBoundingClientRect().width
    const startX = event.clientX
    const startWidth = element.getBoundingClientRect().width
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)

    let percent = Math.round((startWidth / available) * 100)

    const onMove = (move: PointerEvent) => {
      const delta = (move.clientX - startX) * (edge === 'left' ? -1 : 1)
      const next = startWidth + (align === 'center' ? delta * 2 : delta)
      percent = Math.round(Math.min(100, Math.max(MIN_PERCENT, (next / available) * 100)))
      // Written straight to the DOM during the drag: one transaction per
      // gesture means one undo step, not one per pointermove.
      element.style.width = `${percent}%`
    }

    const onUp = () => {
      handle.releasePointerCapture(event.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      updateAttributes({ width: `${percent}%` })
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  return (
    <NodeViewWrapper
      className="img-block"
      data-align={align}
      data-selected={selected ? 'true' : undefined}
    >
      <div className="img-frame" ref={frame} style={{ width }}>
        <img src={node.attrs.src as string} alt={(node.attrs.alt as string) ?? ''} draggable={false} />

        {selected && editor.isEditable ? (
          <>
            <span
              className="img-handle img-handle-left"
              onPointerDown={(event) => startResize(event, 'left')}
            />
            <span
              className="img-handle img-handle-right"
              onPointerDown={(event) => startResize(event, 'right')}
            />

            <div className="img-bar" contentEditable={false}>
              {ALIGNMENTS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="tool-btn"
                  aria-label={label}
                  title={label}
                  aria-pressed={align === id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => updateAttributes({ align: id })}
                >
                  <Icon size={16} weight="bold" />
                </button>
              ))}

              <div className="tool-divider" role="separator" />

              {WIDTH_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="tool-btn img-preset"
                  aria-label={`Width ${preset}`}
                  title={`Width ${preset}`}
                  aria-pressed={width === preset}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => updateAttributes({ width: preset })}
                >
                  {preset.replace('%', '')}
                </button>
              ))}

              <div className="tool-divider" role="separator" />

              <button
                type="button"
                className="tool-btn"
                aria-label="Remove image"
                title="Remove image"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => deleteNode()}
              >
                <TrashSimple size={16} weight="bold" />
              </button>
            </div>
          </>
        ) : null}
      </div>
    </NodeViewWrapper>
  )
}
