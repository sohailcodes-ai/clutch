'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  api,
  ApiError,
  type PublicProfileDto,
  type MatchHistoryEntry,
  type RatingHistoryEntry,
  type PlayerStats,
} from '@/lib/api'
import AppNav from '@/components/clutch/app-nav'
import PlayerCard from '@/components/clutch/player-card'
import RatingCard from '@/components/clutch/rating-card'
import RatingHistoryChart from '@/components/clutch/rating-history-chart'
import TitleBadge from '@/components/clutch/title-badge'
import { EmptyState, ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return '—'
  const sec = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const RESULT_STYLES: Record<string, { label: string; className: string }> = {
  win: { label: 'W', className: 'text-victory' },
  loss: { label: 'L', className: 'text-defeat' },
  draw: { label: 'D', className: 'text-muted-foreground' },
  forfeit: { label: 'FF', className: 'text-warning' },
}

export default function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params)
  const [player, setPlayer] = useState<PublicProfileDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([])
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryEntry[]>([])
  const [stats, setStats] = useState<PlayerStats | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ player: PublicProfileDto }>(`/players/${encodeURIComponent(handle)}`)
      .then((r) => !cancelled && setPlayer(r.player))
      .catch(
        (err) => !cancelled && setError(err instanceof ApiError ? err.message : 'Failed to load profile'),
      )
    return () => {
      cancelled = true
    }
  }, [handle])

  const loadHistory = useCallback(async () => {
    try {
      const [matchRes, ratingRes, statsRes] = await Promise.all([
        api.get<{ matches: MatchHistoryEntry[] }>(
          `/players/${encodeURIComponent(handle)}/matches?limit=20`,
        ),
        api.get<{ history: RatingHistoryEntry[] }>(
          `/players/${encodeURIComponent(handle)}/rating-history?limit=100`,
        ),
        api.get<{ stats: PlayerStats }>(`/players/${encodeURIComponent(handle)}/stats`),
      ])
      setMatches(matchRes.matches)
      setRatingHistory(ratingRes.history)
      setStats(statsRes.stats)
    } catch {
      // Non-fatal — profile card is primary content
    }
  }, [handle])

  useEffect(() => {
    if (player) void loadHistory()
  }, [player, loadHistory])

  if (error) return <ErrorState message={error} />
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1000px] space-y-8 px-4 py-8">
        <SectionTitle>Player</SectionTitle>
        {!player ? (
          <Loading label="Loading profile" />
        ) : (
          <>
            <PlayerCard
              player={{
                handle: player.handle,
                displayName: player.displayName,
                avatarUrl: player.avatarUrl,
                equippedTitle: player.equippedTitle,
                bestRating: player.bestRating ?? 0,
                bestStackId: player.bestStackId,
                tierId: player.tierId,
                globalRank: null,
                wins: player.ratings.reduce((n, r) => n + r.wins, 0),
                losses: player.ratings.reduce((n, r) => n + r.losses, 0),
                draws: player.ratings.reduce((n, r) => n + r.draws, 0),
                gamesPlayed: player.ratings.reduce((n, r) => n + r.gamesPlayed, 0),
                peakRating: player.ratings.reduce(
                  (m, r) => Math.max(m, r.peakRating ?? 0),
                  0,
                ),
                winRate:
                  player.ratings.reduce((n, r) => n + r.wins + r.losses, 0) > 0
                    ? player.ratings.reduce((n, r) => n + r.wins, 0) /
                      player.ratings.reduce((n, r) => n + r.wins + r.losses, 0)
                    : 0,
                currentWinStreak: Math.max(...player.ratings.map((r) => r.currentWinStreak ?? 0), 0),
                bestWinStreak: Math.max(...player.ratings.map((r) => r.bestWinStreak ?? 0), 0),
                competitiveStatus: player.competitiveStatus,
                placementMatchesRequired: player.placementMatchesRequired,
                placementMatchesCompleted: player.placementMatchesCompleted,
                placementRemaining: player.placementRemaining,
              }}
              placement={
                player.competitiveStatus === 'unranked'
                  ? {
                      completed: player.placementMatchesCompleted,
                      total: player.placementMatchesRequired,
                    }
                  : undefined
              }
            />

            {/* Stats row */}
            {stats ? (
              <Panel className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
                <div>
                  <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">Matches</p>
                  <p className="data-mono mt-0.5 text-lg font-black">{stats.total}</p>
                </div>
                <div>
                  <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">Win rate</p>
                  <p className="data-mono mt-0.5 text-lg font-black">
                    {stats.total > 0 ? `${Math.round(stats.winRate * 100)}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">W/L/D</p>
                  <p className="data-mono mt-0.5 text-lg font-black">
                    <span className="text-victory">{stats.wins}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-defeat">{stats.losses}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span>{stats.draws}</span>
                  </p>
                </div>
                {stats.forfeits > 0 ? (
                  <div>
                    <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">Forfeits</p>
                    <p className="data-mono mt-0.5 text-lg font-black text-warning">{stats.forfeits}</p>
                  </div>
                ) : null}
              </Panel>
            ) : null}

            {/* Rating history chart */}
            {ratingHistory.length > 1 ? (
              <div>
                <SectionTitle>Rating history</SectionTitle>
                <Panel className="text-primary">
                  <RatingHistoryChart entries={ratingHistory} />
                </Panel>
              </div>
            ) : null}

            <div>
              <SectionTitle>Titles</SectionTitle>
              {player.titles.length === 0 ? (
                <EmptyState title="No titles earned yet" />
              ) : (
                <Panel className="flex flex-wrap gap-2">
                  {player.titles.map((t) => (
                    <TitleBadge key={t.code} name={t.name} rarity={t.rarity} />
                  ))}
                </Panel>
              )}
            </div>

            <div>
              <SectionTitle>Stack ratings</SectionTitle>
              <RatingCard ratings={player.ratings} />
            </div>

            {/* Match history */}
            <div>
              <SectionTitle>Match history</SectionTitle>
              {matches.length === 0 ? (
                <EmptyState title="No matches played yet" hint="Matches will appear here once completed." />
              ) : (
                <div className="divide-y divide-border/40">
                  {matches.map((m) => {
                    const style = RESULT_STYLES[m.result ?? ''] ?? {
                      label: '?',
                      className: 'text-muted-foreground',
                    }
                    return (
                      <Link
                        key={m.matchId}
                        href={`/match/${m.publicId}`}
                        className="flex items-center justify-between border border-transparent bg-card/30 px-4 py-3 transition-colors hover:border-border hover:bg-card/60"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <span
                            className={`label-mono w-8 shrink-0 text-[0.8rem] font-black ${style.className}`}
                          >
                            {style.label}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-mono text-sm">
                              {m.opponent ? `@${m.opponent.handle}` : 'Unknown opponent'}
                            </p>
                            <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
                              {m.stackId}
                              {' · '}
                              {formatDate(m.endedAt)}
                              {m.startedAt && m.endedAt
                                ? ` · ${formatDuration(m.startedAt, m.endedAt)}`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {m.ratingDelta !== 0 ? (
                            <p
                              className={`font-mono text-sm font-bold ${
                                m.ratingDelta > 0 ? 'text-victory' : 'text-defeat'
                              }`}
                            >
                              {m.ratingDelta > 0 ? '+' : ''}
                              {m.ratingDelta}
                            </p>
                          ) : (
                            <p className="label-mono text-[0.65rem] text-muted-foreground">unrated</p>
                          )}
                          <p className="label-mono text-[0.58rem] text-muted-foreground">
                            {m.ratingBefore} → {m.ratingAfter}
                          </p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  )
}
