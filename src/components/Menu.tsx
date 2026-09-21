'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown'
import { Check } from '@phosphor-icons/react/dist/csr/Check'
import { cx } from './ui'

export type MenuOption<T extends string = string> = {
  value: T
  label: string
  className?: string
  style?: React.CSSProperties
  preview?: boolean
}

type Pos = { top: number; left: number; origin: string; width: number }

const MENU_EVENT = 'essai-menu'

function placePanel(trigger: HTMLElement, minWidth: number): Pos {
  const r = trigger.getBoundingClientRect()
  const width = Math.min(Math.max(minWidth, r.width), window.innerWidth - 16)
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
  const originX = Math.min(Math.max(12, r.left - left + 16), width - 12)
  return { top: r.bottom + 6, left, origin: `${originX}px 0`, width }
}

function useFloating(open: boolean, minWidth: number) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Pos | null>(null)

  const place = useCallback(() => {
    if (!triggerRef.current) return
    setPos(placePanel(triggerRef.current, minWidth))
  }, [minWidth])

  useEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  return { triggerRef, panelRef, pos, place }
}

function useDismiss(
  open: boolean,
  onClose: () => void,
  triggerRef: React.RefObject<HTMLElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const node = event.target as Node
      if (triggerRef.current?.contains(node) || panelRef.current?.contains(node)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, triggerRef, panelRef])
}

const panelClass =
  'menu-in fixed z-[80] rounded-xl border border-line bg-surface p-1 shadow-[0_1px_2px_rgba(26,25,22,0.06),0_16px_40px_-14px_rgba(26,25,22,0.3)]'

type MenuProps<T extends string> = {
  id: string
  openId: string | null
  onOpen: (id: string | null) => void
  label: string
  value: T
  options: MenuOption<T>[]
  onChange: (value: T) => void
  display?: string
  compact?: boolean
  layout?: 'list' | 'grid'
}

export function Menu<T extends string>({
  id,
  openId,
  onOpen,
  label,
  value,
  options,
  onChange,
  display,
  compact,
  layout = 'list',
}: MenuProps<T>) {
  const open = openId === id
  const minWidth = layout === 'grid' ? 176 : compact ? 88 : 228
  const { triggerRef, panelRef, pos, place } = useFloating(open, minWidth)
  const close = useCallback(() => onOpen(null), [onOpen])
  useDismiss(open, close, triggerRef, panelRef)

  const selected = options.find((o) => o.value === value)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open) {
            onOpen(null)
            return
          }
          place()
          onOpen(id)
        }}
        className={cx(
          'h-7 rounded-md inline-flex items-center gap-1 text-[12.5px] text-ink-soft active:scale-[0.97]',
          compact ? 'px-1.5 min-w-[2.4rem] justify-center' : 'px-2',
          open ? 'bg-black/[0.06] text-ink' : 'hover:bg-black/5',
        )}
      >
        <span className="truncate max-w-[7.5rem] leading-none">{display ?? selected?.label}</span>
        <CaretDown
          size={10}
          weight="bold"
          className={cx('shrink-0 text-muted transition-transform duration-150', open && 'rotate-180')}
        />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              aria-label={label}
              className={panelClass}
              style={{
                top: pos.top,
                left: pos.left,
                minWidth: pos.width,
                ['--menu-origin' as string]: pos.origin,
              }}
            >
              {layout === 'grid' ? (
                <div className="grid grid-cols-4 gap-0.5">
                  {options.map((option) => {
                    const active = option.value === value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onChange(option.value)
                          onOpen(null)
                        }}
                        className={cx(
                          'h-8 rounded-lg text-[13px] tabular-nums',
                          active ? 'bg-paper text-ink font-medium ring-1 ring-gold/35' : 'text-ink-soft hover:bg-black/[0.04]',
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                options.map((option) => {
                  const active = option.value === value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(option.value)
                        onOpen(null)
                      }}
                      className={cx(
                        'w-full flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-left',
                        active ? 'bg-paper' : 'hover:bg-black/[0.04]',
                      )}
                    >
                      {option.preview ? (
                        <span
                          className="w-8 shrink-0 text-center text-[15px] leading-none text-ink-soft"
                          style={option.style}
                        >
                          Aa
                        </span>
                      ) : null}
                      <span
                        className={cx('flex-1 min-w-0 text-[13px] text-ink leading-tight', option.className)}
                        style={option.preview ? undefined : option.style}
                      >
                        {option.label}
                      </span>
                      <Check
                        size={13}
                        weight="bold"
                        className={cx('shrink-0 text-gold-ink', active ? 'opacity-100' : 'opacity-0')}
                      />
                    </button>
                  )
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

type Swatch = { value: string; label: string; fill: string }

export function SwatchMenu({
  id,
  openId,
  onOpen,
  label,
  value,
  swatches,
  onChange,
  trigger,
}: {
  id: string
  openId: string | null
  onOpen: (id: string | null) => void
  label: string
  value: string
  swatches: Swatch[]
  onChange: (value: string) => void
  trigger: React.ReactNode
}) {
  const open = openId === id
  const { triggerRef, panelRef, pos, place } = useFloating(open, 220)
  const close = useCallback(() => onOpen(null), [onOpen])
  useDismiss(open, close, triggerRef, panelRef)
  const current = swatches.find((s) => s.value === value)?.label ?? swatches[0]?.label
  const [hint, setHint] = useState(current)

  useEffect(() => {
    if (open) setHint(current)
  }, [open, current])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open) {
            onOpen(null)
            return
          }
          place()
          onOpen(id)
        }}
        className={cx(
          'size-7 grid place-items-center rounded-md active:scale-[0.97]',
          open ? 'bg-black/[0.06] text-ink' : 'text-ink-soft hover:bg-black/5',
        )}
      >
        {trigger}
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              aria-label={label}
              className={cx(panelClass, 'p-2.5')}
              style={{ top: pos.top, left: pos.left, ['--menu-origin' as string]: pos.origin }}
              onMouseLeave={() => setHint(current)}
            >
              <p className="px-0.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
              <div className="flex items-center gap-1.5">
                {swatches.map((swatch) => {
                  const active = swatch.value === value
                  return (
                    <button
                      key={swatch.value || 'none'}
                      type="button"
                      role="option"
                      aria-selected={active}
                      aria-label={swatch.label}
                      title={swatch.label}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHint(swatch.label)}
                      onClick={() => {
                        onChange(swatch.value)
                        onOpen(null)
                      }}
                      className={cx(
                        'size-6 rounded-full border relative overflow-hidden active:scale-95',
                        active ? 'border-ink ring-2 ring-gold/45 ring-offset-1 ring-offset-surface' : 'border-line hover:scale-105',
                      )}
                      style={{ background: swatch.fill }}
                    >
                      {!swatch.value ? (
                        <span className="absolute inset-0 bg-[linear-gradient(135deg,transparent_46%,#b42318_46%,#b42318_54%,transparent_54%)]" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
              <p className="pt-2 text-center text-[11.5px] text-ink-soft">{hint}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export function Dropdown({
  value,
  onChange,
  options,
  className,
  size = 'md',
  label,
}: {
  value: string
  onChange: (value: string) => void
  options: MenuOption[]
  className?: string
  size?: 'sm' | 'md'
  label?: string
}) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const minWidth = size === 'sm' ? 180 : 220
  const { triggerRef, panelRef, pos, place } = useFloating(open, minWidth)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, triggerRef, panelRef)

  useEffect(() => {
    const onOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== uid) setOpen(false)
    }
    window.addEventListener(MENU_EVENT, onOther)
    return () => window.removeEventListener(MENU_EVENT, onOther)
  }, [uid])

  const selected = options.find((o) => o.value === value)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          if (open) {
            setOpen(false)
            return
          }
          window.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: uid }))
          place()
          setOpen(true)
        }}
        className={cx(
          'w-full flex items-center gap-2 text-left text-ink active:scale-[0.99]',
          size === 'md'
            ? 'h-12 rounded-xl border border-line bg-surface px-4 text-[14px]'
            : 'h-7 rounded-lg border border-line bg-surface px-2.5 text-[12px]',
          open ? 'border-gold ring-2 ring-gold/20' : 'hover:border-ink/15',
          className,
        )}
      >
        <span className="flex-1 min-w-0 truncate">{selected?.label ?? 'Choose…'}</span>
        <CaretDown
          size={size === 'md' ? 12 : 10}
          weight="bold"
          className={cx('shrink-0 text-muted transition-transform duration-150', open && 'rotate-180')}
        />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              aria-label={label}
              className={panelClass}
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, minWidth),
                ['--menu-origin' as string]: pos.origin,
              }}
            >
              {options.map((option) => {
                const active = option.value === value
                return (
                  <button
                    key={option.value || 'empty'}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={cx(
                      'w-full flex items-center gap-2 rounded-lg px-2.5 text-left',
                      size === 'md' ? 'py-2 text-[13.5px]' : 'py-1.5 text-[12.5px]',
                      active ? 'bg-paper text-ink' : 'text-ink-soft hover:bg-black/[0.04] hover:text-ink',
                    )}
                  >
                    <span className="flex-1 min-w-0 truncate">{option.label}</span>
                    <Check
                      size={13}
                      weight="bold"
                      className={cx('shrink-0 text-gold-ink', active ? 'opacity-100' : 'opacity-0')}
                    />
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
