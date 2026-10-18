import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' }
export function Button({ variant = 'secondary', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50',
        variant === 'primary' && 'bg-ink text-white hover:bg-stone-700',
        variant === 'accent' && 'bg-brand text-ink hover:bg-brand-dark',
        variant === 'secondary' && 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50',
        variant === 'ghost' && 'text-stone-600 hover:bg-stone-100',
        variant === 'danger' && 'text-red-600 hover:bg-red-50',
        className,
      )}
    />
  )
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink'

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, className)} />
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(inputCls, className)} />
)
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(inputCls, 'pr-8', className)} />
)

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-stone-200 bg-white', className)}>{children}</div>
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-3xl font-bold tracking-wide text-ink">{title}</h1>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

const STATUS_CLS: Record<string, string> = {
  concept: 'bg-stone-100 text-stone-600',
  verzonden: 'bg-blue-50 text-blue-700',
  betaald: 'bg-green-50 text-green-700',
  vervallen: 'bg-red-50 text-red-700',
  geaccepteerd: 'bg-green-50 text-green-700',
  afgewezen: 'bg-stone-100 text-stone-500 line-through',
  geïmporteerd: 'bg-brand-light text-amber-800',
  gecrediteerd: 'bg-purple-50 text-purple-700',
  credit: 'bg-purple-50 text-purple-700',
  verrekend: 'bg-green-50 text-green-700',
  'terug te betalen': 'bg-blue-50 text-blue-700',
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={cx('inline-block self-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium first-letter:uppercase', STATUS_CLS[status] || STATUS_CLS.concept)}>
      {status}
    </span>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4">
      <div
        className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-stone-400 hover:bg-stone-100" aria-label="Sluiten">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-stone-200">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm',
            value === v ? 'border-ink font-medium text-ink' : 'border-transparent text-stone-500 hover:text-stone-800',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-stone-500">{children}</div>
}

export { cx }
