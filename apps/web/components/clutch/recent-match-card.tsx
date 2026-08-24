import type { RecentMatchDto } from '@/lib/api'
import { cn } from '@/lib/utils'

const RESULT_STYLES: Record<string, { label: string; className: string }> = {
  win: { label: 'WIN', className: 'text-emerald-400' },
  loss: { label: 'LOSS', className: 'text-red-400' },
  draw: { label: 'DRAW', className: 'text-muted-foreground' },
  forfeit: { label: 'FORFEIT', className: 'text-orange-300' },
  no_result: { label: '—', className: 'text-muted-foreground' },
}

function formatDuration(sec: number | null) {
  if (sec === null || sec === undefined) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export function RecentMatchCard({ match }: { match: RecentMatchDto }) {
  const result = RESULT_STYLES[match.result] ?? RESULT_STYLES.no_result
  return (
    <div className="flex items-center justify-between border border-border bg-card/30 px-4 py-3">
      <div className="flex min-w-0 items-center gap-4">
        <span className={cn('label-mono w-14 shrink-0 text-[0.7rem] font-black', result.className)}>
          {result.label}
        </span>
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">
            {match.opponentHandle ? `@${match.opponentHandle}` : 'Unknown opponent'}
          </p>
          <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
            {match.stackId}
            {' · '}
            {match.difficultyId}
            {!match.ranked ? ' · unranked' : ''}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {match.ratingDelta !== null ? (
          <p
            className={cn(
              'font-mono text-sm font-bold',
              match.ratingDelta >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {match.ratingDelta >= 0 ? '+' : ''}
            {match.ratingDelta}
          </p>
        ) : (
          <p className="label-mono text-[0.65rem] text-muted-foreground">unrated</p>
        )}
        <p className="label-mono text-[0.62rem] text-muted-foreground">
          {formatDuration(match.durationSec)}
        </p>
      </div>
    </div>
  )
}

export default RecentMatchCard
