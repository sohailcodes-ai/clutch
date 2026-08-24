import type { LiveMatchDto } from '@/lib/api'
import Link from 'next/link'

/**
 * Spectator card for live matches. Only server-sanitized fields are shown —
 * spectators never see source code or hidden test content.
 */
export function MatchCard({
  match,
}: {
  match: Pick<
    LiveMatchDto,
    'publicId' | 'stackName' | 'difficultyId' | 'players' | 'status' | 'ranked'
  >
}) {
  return (
    <div className="flex items-center justify-between border border-border bg-card/30 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm">
          {match.players.map((p) => `@${p.handle ?? '?'}`).join(' vs ') || 'Match forming…'}
        </p>
        <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
          {match.stackName} · {match.difficultyId}
          {match.ranked ? '' : ' · unranked'}
        </p>
      </div>
      <Link
        href={`/spectate/${match.publicId}`}
        className="label-mono shrink-0 border border-border px-3 py-1.5 text-[0.65rem] uppercase transition-colors hover:border-primary hover:text-primary"
      >
        Watch
      </Link>
    </div>
  )
}

export default MatchCard
