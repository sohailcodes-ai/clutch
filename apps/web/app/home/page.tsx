'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, isOnboarded, type DashboardDto, type StackDto, type TitleCatalogEntry } from '@/lib/api'
import { useSession } from '@/lib/session'
import AppNav from '@/components/clutch/app-nav'
import PlayerCard from '@/components/clutch/player-card'
import RatingCard from '@/components/clutch/rating-card'
import RecentMatchCard from '@/components/clutch/recent-match-card'
import TitleBadge from '@/components/clutch/title-badge'
import { EmptyState, ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function HomePage() {
  const { user, loading: sessionLoading } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardDto | null>(null)
  const [stacks, setStacks] = useState<StackDto[]>([])
  const [titles, setTitles] = useState<TitleCatalogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  // Queue state
  const [selectedStack, setSelectedStack] = useState<string>('')
  const [queueBusy, setQueueBusy] = useState(false)
  const [inQueue, setInQueue] = useState(false)
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [dashboard, meta] = await Promise.all([
        api.get<DashboardDto>('/dashboard'),
        api.get<{ stacks: StackDto[] }>('/meta/stacks'),
      ])
      setData(dashboard)
      setStacks(meta.stacks)
      // Prefer the onboarding-chosen stack, then an existing rating row.
      const preferred = user?.profile?.primaryStackId
      if (preferred && meta.stacks.some((s) => s.id === preferred)) {
        setSelectedStack(preferred)
      } else if (!selectedStack && dashboard.ratings.length > 0) {
        setSelectedStack(dashboard.ratings[0]!.stackId)
      } else if (!selectedStack && meta.stacks.length > 0) {
        setSelectedStack(meta.stacks[0]!.id)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard')
    }
  }, [selectedStack, user])

  useEffect(() => {
    if (!sessionLoading && !user) router.replace('/login')
    // Server-authoritative onboarding gate — never localStorage.
    else if (!sessionLoading && user && !isOnboarded(user)) router.replace('/onboarding')
  }, [sessionLoading, user, router])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  useEffect(() => {
    if (!user) return
    api
      .get<{ titles: TitleCatalogEntry[] }>('/titles/catalog')
      .then((r) => setTitles(r.titles))
      .catch(() => {})
  }, [user])

  const pollMatchmaking = useCallback(async () => {
    try {
      const queue = await api.get<{ entry: { status: string } | null }>('/queue')
      setInQueue(queue.entry?.status === 'waiting')
      const active = await api.get<{ match: { id: string } | null }>('/matches/active')
      setActiveMatchId(active.match?.id ?? null)
    } catch {
      /* transient polling errors are non-fatal */
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void pollMatchmaking()
    const t = setInterval(() => void pollMatchmaking(), 3000)
    return () => clearInterval(t)
  }, [user, pollMatchmaking])

  async function findMatch() {
    if (!selectedStack) return
    setQueueBusy(true)
    setError(null)
    try {
      await api.post('/queue/join', { stackId: selectedStack })
      setInQueue(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join queue')
    } finally {
      setQueueBusy(false)
    }
  }

  async function leaveMatchQueue() {
    setQueueBusy(true)
    try {
      await api.delete('/queue')
      setInQueue(false)
    } catch {
      /* ignore */
    } finally {
      setQueueBusy(false)
    }
  }

  if (sessionLoading || (user && !data && !error)) return <Loading label="Loading your arena" />
  if (!user) return null

  const unlockedRecent = titles.filter((t) => t.unlocked).slice(0, 6)

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-8">
        <SectionTitle>Home</SectionTitle>

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {data ? (
          <>
            {(() => {
              // Unranked = every stack still has its full placement set.
              const first = data.ratings[0]
              const unranked =
                data.ratings.length > 0 && data.ratings.every((r) => r.gamesPlayed === 0)
              return unranked && first ? (
                <PlayerCard
                  player={data.playerCard}
                  placement={{
                    completed: first.gamesPlayed,
                    total: first.gamesPlayed + first.placementRemaining,
                  }}
                />
              ) : (
                <PlayerCard player={data.playerCard} />
              )
            })()}

            {/* Recent competitive form — derived from server-side match history */}
            {data.recentMatches.length > 0 ? (
              <Panel className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
                <div>
                  <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">Streak</p>
                  <p className="data-mono mt-0.5 text-lg font-black">
                    {(() => {
                      let streak = 0
                      for (const m of data.recentMatches) {
                        if (m.result === 'win') streak += 1
                        else break
                      }
                      return streak > 0 ? (
                        <span className="text-victory">{streak}W</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    })()}
                  </p>
                </div>
                <div>
                  <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">
                    Net movement (last {data.recentMatches.length})
                  </p>
                  <p
                    className={`data-mono mt-0.5 text-lg font-black ${
                      data.recentMatches.reduce((n, m) => n + (m.ratingDelta ?? 0), 0) >= 0
                        ? 'text-victory'
                        : 'text-defeat'
                    }`}
                  >
                    {data.recentMatches.reduce((n, m) => n + (m.ratingDelta ?? 0), 0) >= 0 ? '+' : ''}
                    {data.recentMatches.reduce((n, m) => n + (m.ratingDelta ?? 0), 0)}
                  </p>
                </div>
                <div>
                  <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">Form</p>
                  <p className="mt-1 flex gap-1">
                    {[...data.recentMatches].reverse().map((m, i) => (
                      <span
                        key={`${m.matchPublicId}-${i}`}
                        title={`${m.result} vs @${m.opponentHandle ?? '?'}`}
                        className={`h-4 w-2 border ${
                          m.result === 'win'
                            ? 'border-victory/50 bg-victory/60'
                            : m.result === 'loss'
                              ? 'border-defeat/50 bg-defeat/60'
                              : 'border-border bg-muted'
                        }`}
                      />
                    ))}
                  </p>
                </div>
              </Panel>
            ) : null}

            {/* CONTINUE COMPETING */}
            <Panel>
              <SectionTitle>Continue competing</SectionTitle>
              {activeMatchId ? (
                <div className="flex flex-col items-start gap-3 border border-primary/60 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-sm font-bold text-primary">Opponent found!</p>
                  <Link
                    href={`/match/${activeMatchId}`}
                    className="label-mono border border-border-strong bg-primary px-4 py-2 text-[0.7rem] font-bold uppercase text-primary-foreground"
                  >
                    Enter match
                  </Link>
                </div>
              ) : inQueue ? (
                <div className="flex flex-col items-start gap-3 border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="label-mono animate-pulse text-xs text-muted-foreground">
                    Searching {stacks.find((s) => s.id === selectedStack)?.name ?? ''} opponents…
                  </p>
                  <button
                    onClick={() => void leaveMatchQueue()}
                    disabled={queueBusy}
                    className="label-mono border border-border px-4 py-2 text-[0.65rem] uppercase transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50"
                  >
                    Cancel search
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1 space-y-1.5">
                    <span className="label-mono block text-[0.62rem] uppercase text-muted-foreground">
                      Stack
                    </span>
                    <select
                      value={selectedStack}
                      onChange={(e) => setSelectedStack(e.target.value)}
                      className="w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                    >
                      {stacks.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => void findMatch()}
                    disabled={queueBusy || !selectedStack}
                    className="label-mono border border-border-strong bg-primary px-6 py-2.5 text-[0.7rem] font-bold uppercase text-primary-foreground transition-opacity disabled:opacity-50"
                  >
                    {queueBusy ? 'Joining…' : 'Find match'}
                  </button>
                </div>
              )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <SectionTitle>Current rank</SectionTitle>
                <RatingCard ratings={data.ratings} stacks={stacks} />
              </div>

              <div>
                <SectionTitle>Recent achievements</SectionTitle>
                {unlockedRecent.length === 0 ? (
                  <EmptyState
                    title="No titles unlocked yet"
                    hint="Win matches to earn your first title."
                    action={
                      <Link href="/titles" className="label-mono text-xs text-primary underline">
                        View all titles
                      </Link>
                    }
                  />
                ) : (
                  <Panel className="space-y-2">
                    {unlockedRecent.map((t) => (
                      <TitleBadge key={t.code} name={t.name} rarity={t.rarity} />
                    ))}
                  </Panel>
                )}
              </div>
            </div>

            <div>
              <SectionTitle>Recent matches</SectionTitle>
              {data.recentMatches.length === 0 ? (
                <EmptyState
                  title="No matches played yet"
                  hint="Your first duel will appear here with rating changes and stats."
                />
              ) : (
                <div className="divide-y divide-border/40">
                  {data.recentMatches.map((m) => (
                    <RecentMatchCard key={m.matchPublicId} match={m} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </>
  )
}
