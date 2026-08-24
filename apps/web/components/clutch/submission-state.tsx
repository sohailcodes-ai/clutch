import { cn } from '@/lib/utils'

export type SubmissionState =
  | 'received'
  | 'queued'
  | 'running'
  | 'accepted'
  | 'wrong_answer'
  | 'time_limit'
  | 'runtime_error'
  | 'compile_error'
  | 'internal_error'

const STATE_META: Record<SubmissionState, { label: string; className: string }> = {
  received: { label: 'Received', className: 'text-muted-foreground border-border' },
  queued: { label: 'Queued', className: 'text-signal border-signal/40' },
  running: { label: 'Running', className: 'text-warning border-warning/40 animate-pulse' },
  accepted: { label: 'Accepted', className: 'text-victory border-victory/40' },
  wrong_answer: { label: 'Wrong Answer', className: 'text-defeat border-defeat/40' },
  time_limit: { label: 'Time Limit', className: 'text-defeat border-defeat/40' },
  runtime_error: { label: 'Runtime Error', className: 'text-defeat border-defeat/40' },
  compile_error: { label: 'Compile Error', className: 'text-warning border-warning/40' },
  internal_error: { label: 'Judge Error', className: 'text-muted-foreground border-border' },
}

/**
 * Canonical submission state chip. Colors map to the competitive token scale
 * (--victory / --defeat / --warning / --signal) so status reads identically
 * across matchmaking, active match and result surfaces.
 */
export function SubmissionStateChip({
  state,
  className,
}: {
  state: SubmissionState
  className?: string
}) {
  const meta = STATE_META[state] ?? STATE_META.received
  return (
    <span
      className={cn(
        'label-mono inline-flex items-center gap-1.5 border px-2 py-0.5 text-[0.6rem]',
        meta.className,
        className,
      )}
    >
      <span className="size-1 rounded-full bg-current" aria-hidden />
      {meta.label}
    </span>
  )
}

export default SubmissionStateChip
