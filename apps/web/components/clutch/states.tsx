import { cn } from '@/lib/utils'

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16" role="status" aria-live="polite">
      <span className="size-1.5 animate-pulse bg-primary" />
      <span className="label-mono text-muted-foreground">{label}…</span>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
      <p className="label-mono text-destructive">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="label-mono border border-border-strong px-4 py-2 transition-colors hover:border-primary hover:text-primary"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 border border-border px-6 py-14 text-center')}>
      <p className="label-mono text-muted-foreground">{title}</p>
      {hint ? <p className="max-w-md text-sm text-muted-foreground/70">{hint}</p> : null}
      {action}
    </div>
  )
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('border border-border bg-card/40 p-5 sm:p-6', className)}>
      {children}
    </section>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="label-mono mb-4 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
      <span className="size-1.5 bg-primary" aria-hidden />
      {children}
    </h2>
  )
}
