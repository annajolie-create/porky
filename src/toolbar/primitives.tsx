import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown'

/**
 * Every control in here cancels mousedown. That is what keeps the document
 * selection alive while the toolbar is clicked: without it the editor blurs,
 * the selection collapses, and the command lands on an empty range.
 */
const keepSelection = (event: { preventDefault: () => void }) => event.preventDefault()

export function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="tool-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Divider() {
  return <div className="tool-divider" role="separator" />
}

export function Dropdown({
  label,
  trigger,
  width,
  align = 'start',
  children,
}: {
  label: string
  trigger: ReactNode
  width?: number
  align?: 'start' | 'end'
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="tool-menu" ref={root}>
      <button
        type="button"
        className="tool-trigger"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={keepSelection}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
        <CaretDown size={10} weight="bold" className="tool-caret" />
      </button>

      {open ? (
        <div
          className={`tool-pop tool-pop-${align}`}
          role="menu"
          style={width ? { width } : undefined}
          onMouseDown={keepSelection}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  )
}

export function MenuItem({
  active,
  onClick,
  style,
  children,
}: {
  active?: boolean
  onClick: () => void
  style?: React.CSSProperties
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={Boolean(active)}
      className="menu-item"
      style={style}
      onMouseDown={keepSelection}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function MenuAction({
  icon,
  active,
  onClick,
  children,
}: {
  icon: ReactNode
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-pressed={active}
      className="menu-item menu-action"
      onMouseDown={keepSelection}
      onClick={onClick}
    >
      <span className="menu-icon">{icon}</span>
      {children}
    </button>
  )
}
