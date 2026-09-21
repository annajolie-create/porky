'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function cx(...parts: (string | number | false | null | undefined)[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
  size?: 'sm' | 'md'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:scale-[0.98]'
  const sizes = size === 'sm' ? 'h-8 px-3 text-[12.5px] rounded-lg' : 'h-10 px-4 text-[13.5px] rounded-xl'
  const variants = {
    primary: 'bg-gold text-ink hover:bg-gold/90',
    secondary: 'bg-surface border border-line text-ink hover:border-line-strong hover:bg-paper',
    ghost: 'text-ink-soft hover:bg-black/5',
    danger: 'text-del hover:bg-del-bg',
    soft: 'bg-gold-soft text-gold-ink hover:bg-[#efe0a4]',
  }[variant]
  return (
    <button ref={ref} className={cx(base, sizes, variants, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
})

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx('inline-block size-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin', className)}
      aria-hidden
    />
  )
}

export function Dots({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted text-[12.5px]">
      <span className="inline-flex gap-0.5">
        <span className="size-1 rounded-full bg-current pulse-dot" />
        <span className="size-1 rounded-full bg-current pulse-dot [animation-delay:200ms]" />
        <span className="size-1 rounded-full bg-current pulse-dot [animation-delay:400ms]" />
      </span>
      {label}
    </span>
  )
}

export function Field({
  label,
  hint,
  optional,
  children,
  className,
}: {
  label: string
  hint?: string
  optional?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('block', className)}>
      <span className="flex items-baseline gap-2 mb-2">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        {optional ? <span className="text-[12px] text-muted">optional</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[12px] text-muted mt-1.5">{hint}</span> : null}
    </label>
  )
}

const control =
  'w-full rounded-xl border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-muted/80 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 transition-shadow'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(control, 'h-12', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(control, 'min-h-[96px] leading-relaxed', className)} {...rest} />
})

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(control, 'h-12 appearance-none bg-no-repeat bg-[right_14px_center] pr-9', className)} style={{ backgroundImage: CHEVRON }} {...rest}>
      {children}
    </select>
  )
}

const CHEVRON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a877c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")"

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-surface shadow-soft', className)}>{children}</div>
}

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'ok' | 'bad'; className?: string }) {
  const tones = {
    neutral: 'bg-paper text-ink-soft border-line',
    accent: 'bg-accent-soft text-gold-ink border-gold/25',
    warn: 'bg-warn-bg text-warn border-warn/20',
    ok: 'bg-ins-bg text-ins border-ins/20',
    bad: 'bg-del-bg text-del border-del/20',
  }[tone]
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-4', tones, className)}>
      {children}
    </span>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-del/20 bg-del-bg/60 px-3 py-2 text-[12.5px] text-del fade-in">
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2 hover:no-underline">
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function SectionHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-6">
        <h1 className="font-serif text-[32px] font-semibold tracking-[-0.02em] text-ink leading-none">{title}</h1>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
      {description ? <p className="text-[15px] text-muted mt-3 max-w-[62ch] leading-relaxed">{description}</p> : null}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {body ? <p className="text-[13.5px] text-muted mt-1.5 max-w-[46ch] mx-auto">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 p-0 bg-transparent border-0 cursor-pointer select-none"
    >
      <span className="text-[12.5px] text-muted">{label}</span>
      <span
        aria-hidden
        className={cx(
          'relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full transition-colors',
          checked ? 'bg-gold' : 'bg-line-strong',
        )}
      >
        <span
          className={cx(
            'absolute top-[3px] left-[3px] size-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[16px]' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  )
}
