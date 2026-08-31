'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  api,
  ApiError,
  type LiveMatchDto,
  type RecentResultDto,
  type RoomListItemDto,
} from '@/lib/api'
import AppNav from '@/components/clutch/app-nav'
import MatchCard from '@/components/clutch/match-card'
import RoomCard from '@/components/clutch/room-card'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function ExplorePage() {
  const [live, setLive] = useState<LiveMatchDto[] | null>(null)
  const [results, setResults] = useState<RecentResultDto[] | null>(null)
  const [rooms, setRooms] = useState<RoomListItemDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadAll() {
    setError(null)
    try {
      const [liveRes, resultsRes, roomsRes] = await Promise.all([
        api.get<{ liveMatches: LiveMatchDto[] }>('/explore/live'),
        api.get<{ results: RecentResultDto[] }>('/explore/results'),
        api.get<{ rooms: RoomListItemDto[] }>('/rooms'),
      ])
      setLive(liveRes.liveMatches)
      setResults(resultsRes.results)
      setRooms(roomsRes.rooms)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load explore feed')
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  if (error) return <ErrorState message={error} onRetry={() => void loadAll()} />

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-8">
        <SectionTitle>Explore</SectionTitle>

        {/* LIVE NOW */}
        <div>
          <SectionTitle>Live now</SectionTitle>
          {!live ? (
            <Loading label="Scanning arenas" />
          ) : live.length === 0 ? (
            <Panel className="label-mono text-xs text-muted-foreground">
              No live matches right now — be the first to queue.
            </Panel>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {live.map((m) => (
                <MatchCard key={m.publicId} match={m} />
              ))}
            </div>
          )}
        </div>

        {/* OPEN ROOMS */}
        <div>
          <SectionTitle>Open rooms</SectionTitle>
          {!rooms ? (
            <Loading label="Loading rooms" />
          ) : rooms.length === 0 ? (
            <Panel className="label-mono flex items-center justify-between text-xs text-muted-foreground">
              No open rooms.
              <Link href="/rooms" className="underline hover:text-primary">
                Create one
              </Link>
            </Panel>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rooms.slice(0, 6).map((r) => (
                <RoomCard key={r.id} room={r} />
              ))}
            </div>
          )}
        </div>

        {/* RECENT RESULTS */}
        <div>
          <SectionTitle>Recent results</SectionTitle>
          {!results ? (
            <Loading label="Loading results" />
          ) : results.length === 0 ? (
            <Panel className="label-mono text-xs text-muted-foreground">No results yet.</Panel>
          ) : (
            <Panel className="space-y-1.5">
              {results.map((r) => (
                <p key={r.publicId} className="font-mono text-xs">
                  <span className="text-emerald-400">@{r.winnerHandle ?? '?'}</span>
                  {' defeated '}
                  <span>@{r.loserHandle ?? '?'}</span>
                  <span className="ml-2 text-[0.62rem] uppercase text-muted-foreground">{r.stackName}</span>
                </p>
              ))}
            </Panel>
          )}
        </div>
      </main>
    </>
  )
}
