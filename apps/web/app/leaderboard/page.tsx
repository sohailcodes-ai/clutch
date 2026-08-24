'use client'

import { useEffect, useState } from 'react'
import { api, ApiError, type StackDto } from '@/lib/api'
import AppNav from '@/components/clutch/app-nav'
import ClutchLogo from '@/components/brand/clutch-logo'
import LeaderboardRow from '@/components/clutch/leaderboard-row'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'
import { cn } from '@/lib/utils'

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Parameters<typeof LeaderboardRow>[0]['entry'][] | null>(null)
  const [stacks, setStacks] = useState<StackDto[]>([])
  const [stackId, setStackId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ stacks: StackDto[] }>('/meta/stacks')
      .then((r) => {
        setStacks(r.stacks)
        if (r.stacks[0]) setStackId((cur) => cur || r.stacks[0]!.id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!stackId) return
    setEntries(null)
    setError(null)
    api
      .get<{ entries: Parameters<typeof LeaderboardRow>[0]['entry'][] }>(
        `/leaderboard/${encodeURIComponent(stackId)}`,
      )
      .then((r) => setEntries(r.entries))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load leaderboard'),
      )
  }, [stackId])

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[900px] space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle>Leaderboard</SectionTitle>
          <p className="label-mono flex items-center gap-1.5 pb-4 text-[0.6rem] uppercase text-muted-foreground">
            <ClutchLogo size={11} label="" /> global ladder
          </p>
        </div>

        <div className="flex flex-wrap gap-1 border border-border p-1">
          {stacks.map((s) => (
            <button
              key={s.id}
              onClick={() => setStackId(s.id)}
              aria-pressed={stackId === s.id}
              className={cn(
                'label-mono flex-1 whitespace-nowrap py-2 text-[0.62rem] uppercase transition-colors',
                stackId === s.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>

        {error ? (
          <ErrorState message={error} />
        ) : !entries ? (
          <Loading label="Loading ladder" />
        ) : entries.length === 0 ? (
          <Panel className="label-mono text-xs text-muted-foreground">
            No ranked players yet for this stack. Play 5 matches to appear on the ladder.
          </Panel>
        ) : (
          <Panel className="p-0">
            {entries.map((e) => (
              <LeaderboardRow key={e.userId} entry={e} />
            ))}
          </Panel>
        )}

        <p className="label-mono text-center text-[0.58rem] text-muted-foreground/60">
          Ratings are computed server-side from completed ranked matches.
        </p>
      </main>
    </>
  )
}
