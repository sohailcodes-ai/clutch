import type { PlayerCardDto } from '@/lib/api'
import { TitleBadge } from './title-badge'

/**
 * Reusable competitive identity card. Renders ONLY public DTO fields — the
 * server guarantees no email, session or security metadata is present.
 *
 * `placement` switches the card into its pre-ladder state (UNRANKED +
 * placement progress) for players the server reports as unranked.
 */
export function PlayerCard({
  player,
  placement,
  compact = false,
}: {
  player: PlayerCardDto
  placement?: { completed: number; total: number }
  compact?: boolean
}) {
  const decided = player.wins + player.losses
  const unranked = placement !== undefined
  return (
    <div className="flex flex-col gap-4 border border-border bg-card/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-center gap-4">
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.avatarUrl} alt="" className="size-14 border border-border object-cover" />
        ) : (
          <div className="grid size-14 place-items-center border border-border text-lg font-black text-primary">
            {player.handle.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-mono text-lg font-bold">@{player.handle}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {player.equippedTitle ? (
              <TitleBadge name={player.equippedTitle.name} rarity={player.equippedTitle.rarity} />
            ) : null}
            {!compact && !unranked && player.tierId ? (
              <span className="label-mono text-[0.65rem] uppercase text-muted-foreground">
                {player.tierId}
              </span>
            ) : null}
            {unranked ? (
              <span className="label-mono border border-warning/50 px-2 py-0.5 text-[0.62rem] font-black uppercase text-warning">
                Unranked
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {unranked ? (
        <dl className="text-right">
          <dt className="label-mono text-[0.6rem] uppercase text-muted-foreground">
            Placement matches
          </dt>
          <dd className="data-mono mt-1 text-2xl font-black">
            {placement!.completed}
            <span className="text-muted-foreground"> / {placement!.total}</span>
          </dd>
          <dd className="label-mono mt-1 text-[0.58rem] normal-case tracking-normal text-muted-foreground">
            Win placements to reveal your rating & tier
          </dd>
        </dl>
      ) : (
        <dl className="grid grid-cols-3 gap-x-8 gap-y-1 text-right">
          <div>
            <dt className="label-mono text-[0.6rem] uppercase text-muted-foreground">Rating</dt>
            <dd className="text-xl font-black text-primary">{player.bestRating}</dd>
          </div>
          <div>
            <dt className="label-mono text-[0.6rem] uppercase text-muted-foreground">Peak</dt>
            <dd className="text-xl font-black">{player.peakRating}</dd>
          </div>
          <div>
            <dt className="label-mono text-[0.6rem] uppercase text-muted-foreground">Rank</dt>
            <dd className="text-xl font-black">
              {player.globalRank ? `#${player.globalRank}` : '—'}
            </dd>
          </div>
          <div className="col-span-3 label-mono text-[0.65rem] text-muted-foreground">
            W {player.wins} · L {player.losses} · D {player.draws}
            {decided > 0 ? ` · ${Math.round(player.winRate * 100)}% win` : ''}
          </div>
        </dl>
      )}
    </div>
  )
}

export default PlayerCard
