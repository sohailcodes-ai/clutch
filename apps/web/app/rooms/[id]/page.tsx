'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { api, ApiError, type RoomDetailDto } from '@/lib/api'
import { useSession } from '@/lib/session'
import AppNav from '@/components/clutch/app-nav'
import { RoomDetailCard } from '@/components/clutch/room-card'
import { ErrorState, Loading, Panel } from '@/components/clutch/states'

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, loading: sessionLoading } = useSession()
  const [room, setRoom] = useState<RoomDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ room: RoomDetailDto }>(`/rooms/${id}`)
      setRoom(res.room)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load room')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function action(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (!room) return error ? <ErrorState message={error} onRetry={() => void load()} /> : <Loading />

  const isMember =
    user && room.players.some((p) => p.handle === (user.profile?.handle ?? null))
  const isHost = room.hostHandle === user?.profile?.handle
  const readyCount = room.players.filter((p) => p.readyAt).length

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[800px] space-y-6 px-4 py-8">
        {error ? <ErrorState message={error} /> : null}
        <RoomDetailCard room={room} />

        {!sessionLoading ? (
          isMember ? (
            <Panel className="flex flex-wrap items-center gap-3">
              <span className="label-mono text-xs text-muted-foreground">
                {readyCount}/{room.players.length} ready · {room.players.length}/{room.maxPlayers} players
              </span>
              <button
                onClick={() =>
                  void action(async () => {
                    const me = room.players.find((p) => p.handle === user.profile?.handle)
                    const isReady = Boolean(me?.readyAt)
                    await api.post(`/rooms/${id}/ready`, { ready: !isReady })
                  })
                }
                disabled={busy || room.status !== 'open'}
                className="label-mono border border-border-strong bg-primary px-4 py-2 text-[0.65rem] font-bold uppercase text-primary-foreground disabled:opacity-50"
              >
                Toggle ready
              </button>
              {isHost ? (
                <button
                  onClick={() => void action(() => api.post(`/rooms/${id}/start`))}
                  disabled={busy || room.status !== 'open' || readyCount < 2}
                  className="label-mono border border-border px-4 py-2 text-[0.65rem] uppercase transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                >
                  Start duel (2 ready)
                </button>
              ) : null}
              <button
                onClick={() => void action(() => api.delete(`/rooms/${id}/leave`))}
                disabled={busy}
                className="label-mono ml-auto border border-border px-4 py-2 text-[0.62rem] uppercase text-muted-foreground transition-colors hover:border-red-400 hover:text-red-400"
              >
                Leave room
              </button>
            </Panel>
          ) : (
            <Panel className="flex flex-wrap items-end gap-3">
              {!room.isPublic ? (
                <label className="flex-1 space-y-1.5">
                  <span className="label-mono block text-[0.6rem] uppercase text-muted-foreground">
                    Join code required
                  </span>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="ABC123"
                    className="w-full border border-border bg-background px-3 py-2 font-mono uppercase tracking-widest outline-none focus:border-primary"
                  />
                </label>
              ) : null}
              <button
                onClick={() => void action(() => api.post(`/rooms/${id}/join`, { joinCode: joinCode || undefined }))}
                disabled={busy || sessionLoading || !user}
                className="label-mono border border-border-strong bg-primary px-5 py-2 text-[0.68rem] font-bold uppercase text-primary-foreground disabled:opacity-50"
              >
                Join room
              </button>
              {!user ? (
                <span className="label-mono text-[0.62rem] text-muted-foreground">Sign in to join.</span>
              ) : null}
            </Panel>
          )
        ) : null}
      </main>
    </>
  )
}
