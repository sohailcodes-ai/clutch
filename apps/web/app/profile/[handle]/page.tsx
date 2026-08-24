'use client'

import { use, useEffect, useState } from 'react'
import {
  api,
  ApiError,
  type PublicProfileDto,
} from '@/lib/api'
import AppNav from '@/components/clutch/app-nav'
import PlayerCard from '@/components/clutch/player-card'
import RatingCard from '@/components/clutch/rating-card'
import RecentMatchCard from '@/components/clutch/recent-match-card'
import TitleBadge from '@/components/clutch/title-badge'
import { EmptyState, ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params)
  const [player, setPlayer] = useState<PublicProfileDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ player: PublicProfileDto }>(`/players/${encodeURIComponent(handle)}`)
      .then((r) => !cancelled && setPlayer(r.player))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : 'Failed to load profile'))
    return () => {
      cancelled = true
    }
  }, [handle])

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
                bestRating: player.bestRating ?? 1000,
                bestStackId: player.bestStackId,
                tierId: player.tierId,
                globalRank: null,
                wins: player.ratings.reduce((n, r) => n + r.wins, 0),
                losses: player.ratings.reduce((n, r) => n + r.losses, 0),
                draws: player.ratings.reduce((n, r) => n + r.draws, 0),
                gamesPlayed: player.ratings.reduce((n, r) => n + r.gamesPlayed, 0),
                peakRating: player.ratings.reduce((m, r) => Math.max(m, r.peakRating), 0),
                winRate:
                  player.ratings.reduce((n, r) => n + r.wins + r.losses, 0) > 0
                    ? player.ratings.reduce((n, r) => n + r.wins, 0) /
                      player.ratings.reduce((n, r) => n + r.wins + r.losses, 0)
                    : 0,
              }}
            />

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
          </>
        )}
      </main>
    </>
  )
}
