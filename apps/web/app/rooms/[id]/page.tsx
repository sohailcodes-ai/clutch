'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, type RoomDetailDto } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useWs } from '@/lib/ws'
import AppNav from '@/components/clutch/app-nav'
import { RoomDetailCard } from '@/components/clutch/room-card'
import { ErrorState, Loading, Panel } from '@/components/clutch/states'

const ROOM_EVENTS = new Set([
  'room.created', 'room.updated', 'room.joined', 'room.left',
  'room.ready', 'room.unready', 'room.locked', 'room.started',
  'room.match_created', 'room.finished', 'room.cancelled', 'room.snapshot',
])

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

  useEffect(() => { void load() }, [load])

  const loadRef = useRef(load)
  loadRef.current = load

  // Subscribe to room WS events and refresh on any room event
  const { connected, subscribe } = useWs({
    onMessage: useCallback((msg: { type?: string; roomId?: string }) => {
      if (msg.type && ROOM_EVENTS.has(msg.type) && msg.roomId === id) {
        void loadRef.current()
      }
    }, [id]),
  })

  // Subscribe to room channel once connected
  useEffect(() => {
    if (connected) {
      subscribe('room.subscribe', { roomId: id })
    }
  }, [connected, subscribe, id])

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

  const me = user ? room.players.find((p) => p.handle === user.profile?.handle) : null
  const isMember = me != null
  const isHost = me?.isHost === true
  const readyCount = room.players.filter((p) => p.readyAt).length
  const isOpen = room.status === 'open'
  const isInProgress = room.status === 'in_progress'
  const isLocked = room.status === 'locked'
  const isFinished = room.status === 'finished'
  const canStart = isHost && isOpen && readyCount >= 2

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[800px] space-y-6 px-4 py-8">
        {error ? <ErrorState message={error} /> : null}
        <RoomDetailCard room={room} />

        {room.status !== 'open' ? (
          <Panel className="flex items-center gap-3">
            <span className="label-mono text-xs font-bold uppercase text-primary">
              {room.status === 'locked' ? 'Locked — waiting for match…' :
               room.status === 'in_progress' ? 'Match in progress…' :
               room.status === 'finished' ? 'Match finished' :
               room.status === 'cancelled' ? 'Room cancelled' :
               room.status}
            </span>
          </Panel>
        ) : null}

        {!sessionLoading && isMember && isOpen ? (
          <Panel className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="label-mono text-xs text-muted-foreground">
                {readyCount}/{room.players.length} ready · {room.players.length}/{room.maxPlayers} players
              </span>
              <button
                onClick={() =>
                  void action(async () => {
                    const isReady = Boolean(me?.readyAt)
                    await api.post(`/rooms/${id}/ready`, { ready: !isReady })
                  })
                }
                disabled={busy}
                className="label-mono border border-border-strong bg-primary px-4 py-2 text-[0.65rem] font-bold uppercase text-primary-foreground disabled:opacity-50"
              >
                {me?.readyAt ? 'Unready' : 'Ready up'}
              </button>
              {isHost ? (
                <>
                  <button
                    onClick={() => void action(() => api.post(`/rooms/${id}/lock`))}
                    disabled={busy}
                    className="label-mono border border-border px-4 py-2 text-[0.65rem] uppercase transition-colors hover:border-amber-400 hover:text-amber-400 disabled:opacity-40"
                  >
                    Lock room
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Start the match? This will lock the room.')) {
                        void action(() => api.post(`/rooms/${id}/start`))
                      }
                    }}
                    disabled={!canStart}
                    className="label-mono border border-border px-4 py-2 text-[0.65rem] uppercase transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                  >
                    Start match ({readyCount} ready)
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Cancel this room? This cannot be undone.')) {
                        void action(() => api.post(`/rooms/${id}/cancel`))
                      }
                    }}
                    disabled={busy}
                    className="label-mono ml-auto border border-border px-4 py-2 text-[0.62rem] uppercase text-muted-foreground transition-colors hover:border-red-400 hover:text-red-400"
                  >
                    Cancel room
                  </button>
                </>
              ) : (
                <button
                  onClick={() => void action(() => api.delete(`/rooms/${id}/leave`))}
                  disabled={busy}
                  className="label-mono ml-auto border border-border px-4 py-2 text-[0.62rem] uppercase text-muted-foreground transition-colors hover:border-red-400 hover:text-red-400"
                >
                  Leave room
                </button>
              )}
            </div>

            {isHost ? (
              <div className="flex flex-wrap gap-1.5">
                {room.players.filter((p) => !p.isHost).map((p) => (
                  <div key={p.handle ?? ''} className="flex items-center gap-1.5 border border-border px-2 py-1 text-[0.6rem]">
                    <span className="font-mono">{p.handle ? `@${p.handle}` : 'Unknown'}</span>
                    <span className="text-muted-foreground">{p.readyAt ? '✓' : '…'}</span>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove @${p.handle} from the room?`)) {
                          void action(() => api.delete(`/rooms/${id}/participants/${p.handle}`))
                        }
                      }}
                      disabled={busy}
                      className="ml-1 text-red-400 hover:text-red-300"
                      title="Kick player"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>
        ) : null}

        {!sessionLoading && !isMember && isOpen ? (
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
        ) : null}
      </main>
    </>
  )
}
