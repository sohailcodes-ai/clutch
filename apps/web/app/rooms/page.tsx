'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  api,
  ApiError,
  type RoomDetailDto,
  type RoomListItemDto,
  type StackDto,
} from '@/lib/api'
import AppNav from '@/components/clutch/app-nav'
import RoomCard from '@/components/clutch/room-card'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomListItemDto[] | null>(null)
  const [stacks, setStacks] = useState<StackDto[]>([])
  const [error, setError] = useState<string | null>(null)

  // create form
  const [name, setName] = useState('')
  const [stackId, setStackId] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [isPublic, setIsPublic] = useState(true)
  const [ranked, setRanked] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const [roomsRes, metaRes] = await Promise.all([
        api.get<{ rooms: RoomListItemDto[] }>('/rooms'),
        api.get<{ stacks: StackDto[] }>('/meta/stacks'),
      ])
      setRooms(roomsRes.rooms)
      setStacks(metaRes.stacks)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load rooms')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createRoom(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await api.post<{ room: RoomDetailDto }>('/rooms', {
        name,
        stackId,
        maxPlayers,
        isPublic,
        ranked,
      })
      window.location.href = `/rooms/${res.room.id}`
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create room')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1000px] space-y-8 px-4 py-8">
        <SectionTitle>Rooms</SectionTitle>

        <Panel>
          <form onSubmit={createRoom} className="space-y-4">
            <p className="label-mono text-[0.65rem] uppercase text-muted-foreground">Create a room</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={3}
                maxLength={64}
                placeholder="Python Arena"
                className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
              <select
                value={stackId}
                onChange={(e) => setStackId(e.target.value)}
                required
                className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              >
                <option value="" disabled>
                  Stack…
                </option>
                {stacks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              >
                {[2, 4, 6, 8, 12, 16].map((n) => (
                  <option key={n} value={n}>
                    {n} players
                  </option>
                ))}
              </select>
              <div className="label-mono flex items-center gap-4 text-[0.62rem] uppercase text-muted-foreground">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!isPublic} onChange={(e) => setIsPublic(!e.target.checked)} />
                  private
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={ranked} onChange={(e) => setRanked(e.target.checked)} />
                  ranked
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="label-mono border border-border-strong bg-primary px-5 py-2 text-[0.68rem] font-bold uppercase text-primary-foreground disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create room'}
            </button>
          </form>
        </Panel>

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {!rooms ? (
          <Loading label="Loading open rooms" />
        ) : rooms.length === 0 ? (
          <Panel className="label-mono text-xs text-muted-foreground">No open public rooms.</Panel>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rooms.map((r) => (
              <RoomCard key={r.id} room={r} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
