import type { StackRatingDto, StackDto } from '@/lib/api'
import { Panel } from './states'

/** Per-stack rating ladder card — reads only from the authoritative ratings API. */
export function RatingCard({
  ratings,
  stacks,
}: {
  ratings: StackRatingDto[]
  stacks?: StackDto[]
}) {
  const stackName = (id: string) => stacks?.find((s) => s.id === id)?.name ?? id
  if (ratings.length === 0) {
    return (
      <Panel className="label-mono text-xs text-muted-foreground">
        No rated games yet — queue up to start your placement matches.
      </Panel>
    )
  }
  return (
    <Panel>
      <ul className="divide-y divide-border/60">
        {ratings.map((r) => {
          const inPlacement = r.placementRemaining > 0
          return (
            <li key={r.stackId} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <div>
                <p className="font-mono text-sm">{stackName(r.stackId)}</p>
                <p className="label-mono text-[0.6rem] uppercase text-muted-foreground">
                  {inPlacement ? (
                    <span className="border border-warning/50 px-1.5 py-0.5 font-black text-warning">
                      Unranked · {r.placementCompleted}/{r.placementRemaining + r.placementCompleted} placement
                    </span>
                  ) : (
                    (r.tierId ?? 'unranked')
                  )}
                </p>
              </div>
              <div className="text-right font-mono text-sm">
                <span className={`font-bold ${inPlacement ? 'text-muted-foreground' : 'text-primary'}`}>
                  {r.rating ?? '—'}
                </span>
                {inPlacement ? (
                  <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">provisional</p>
                ) : null}
                <span className="label-mono ml-3 text-[0.62rem] text-muted-foreground">
                  {r.wins}W/{r.losses}L/{r.draws}D
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

export default RatingCard
