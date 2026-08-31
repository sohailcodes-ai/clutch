import Link from 'next/link'
import { cn } from '@/lib/utils'

export type LeaderboardEntryDto = {
  userId: string
  rank: number
  handle: string | null
  displayName?: string | null
  avatarUrl: string | null
  rating: number
  peakRating: number
  tierId: string | null
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  percentile?: number | null
  titles?: { code: string; name: string }[]
  equippedTitleId?: string | null
}

/** Reusable leaderboard row built on public competitive identity only. */
export function LeaderboardRow({ entry }: { entry: LeaderboardEntryDto }) {
  const podium = entry.rank <= 3
  const equippedTitle = entry.titles?.[0]
  return (
    <Link
      href={`/profile/${entry.handle ?? ''}`}
      className={cn(
        'flex items-center gap-4 border-b border-border/40 px-4 py-3 transition-colors last:border-b-0 hover:bg-card/60',
        podium && 'bg-primary/[0.04]',
      )}
    >
      <span
        className={cn(
          'data-mono w-10 shrink-0 text-right text-sm font-bold',
          entry.rank === 1 ? 'text-primary' : podium ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        #{entry.rank}
      </span>
      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.avatarUrl} alt="" className="size-8 border border-border object-cover" />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center border border-border text-[0.6rem] font-black text-muted-foreground">
          {(entry.handle ?? '?').slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm">@{entry.handle ?? '?'}</p>
        <p className="label-mono text-[0.58rem] uppercase text-muted-foreground">
          {entry.tierId ?? 'unranked'} · {entry.wins}W/{entry.losses}L/{entry.draws}D · peak{' '}
          {entry.peakRating}
          {equippedTitle ? (
            <span className="ml-2 border border-border px-1 py-0 text-[0.55rem] text-foreground/70">
              {equippedTitle.name}
            </span>
          ) : null}
        </p>
      </div>
      <span className="data-mono shrink-0 text-base font-black text-primary">{entry.rating}</span>
    </Link>
  )
}

export default LeaderboardRow
