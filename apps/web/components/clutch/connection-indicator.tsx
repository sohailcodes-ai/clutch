'use client'

import type { ConnectionStatus } from '@/lib/ws'
import { cn } from '@/lib/utils'

const STATUS_META: Record<
  ConnectionStatus,
  { label: string; className: string; ariaLabel: string }
> = {
  connecting: {
    label: 'Connecting',
    className: 'text-muted-foreground animate-pulse',
    ariaLabel: 'Connecting to server',
  },
  connected: {
    label: 'Connected',
    className: 'text-victory',
    ariaLabel: 'Connected to server',
  },
  reconnecting: {
    label: 'Reconnecting…',
    className: 'text-warning animate-pulse',
    ariaLabel: 'Reconnecting to server',
  },
  disconnected: {
    label: 'Connection lost',
    className: 'text-defeat',
    ariaLabel: 'Connection lost, retrying',
  },
}

/**
 * Compact connection indicator. Text + subtle dot — no reliance on color alone.
 */
export function ConnectionIndicator({
  status,
  className,
}: {
  status: ConnectionStatus
  className?: string
}) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn('label-mono inline-flex items-center gap-1.5 text-[0.58rem] uppercase', meta.className, className)}
      role="status"
      aria-live="polite"
      aria-label={meta.ariaLabel}
    >
      <span
        className={cn(
          'size-1 rounded-full bg-current',
          status === 'connected' ? '' : 'animate-pulse',
        )}
        aria-hidden
      />
      {meta.label}
    </span>
  )
}

export default ConnectionIndicator
