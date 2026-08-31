'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { useWs } from '@/lib/ws'
import AppNav from '@/components/clutch/app-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

type SpectatorSnapshot = {
  publicId: string
  status: string
  stackName: string
  difficultyId: string
  ranked: boolean
  question: {
    title: string
    promptMd: string
    examples: unknown[]
    publicTestCount: number
  }
  timeLimitSec: number
  startedAt: string | null
  endsAt: string | null
  serverTimeMs: number
  participants: {
    handle: string | null
    avatarUrl: string | null
    passedCount: number
    totalWeight: number
    attempts: number
    slot: number
  }[]
  spectatorCount?: number
}

type EditorState = {
  [slot: number]: string
}

/**
 * Spectator view.
 * - Ranked matches: shows player info, timer, submission status only.
 * - Challenge matches: also shows live editor updates.
 */
export default function SpectatePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params)
  const [snapshot, setSnapshot] = useState<SpectatorSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [liveCodeAllowed, setLiveCodeAllowed] = useState(false)
  const [editors, setEditors] = useState<EditorState>({})
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const { subscribe, connected } = useWs({
    onMessage: (msg) => {
      if (msg.type === 'spectator.snapshot' && msg.payload) {
        const payload = msg.payload as { match: SpectatorSnapshot; liveCodeAllowed: boolean }
        setSnapshot(payload.match)
        setLiveCodeAllowed(payload.liveCodeAllowed)
      } else if (msg.type === 'editor.update_broadcast' && msg.payload) {
        const payload = msg.payload as { userId: string; slot: number; code?: string }
        if (payload.code !== undefined) {
          setEditors((prev) => ({ ...prev, [payload.slot]: payload.code! }))
        }
      } else if (msg.type === 'editor.snapshot' && msg.payload) {
        const payload = msg.payload as { editors: Record<number, string> }
        setEditors(payload.editors)
      } else if (msg.type === 'spectator.count' && msg.payload) {
        const payload = msg.payload as { count: number }
        setSpectatorCount(payload.count)
      } else if (msg.type === 'match.resolved' || msg.type === 'match.evaluating') {
        void load()
      }
    },
  })

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ match: SpectatorSnapshot }>(`/spectate/${publicId}`)
      setSnapshot(res.match)
      setLiveCodeAllowed(!res.match.ranked)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Match not found')
    }
  }, [publicId])

  useEffect(() => {
    void load()
  }, [load])

  // Subscribe to spectator channel when connected
  useEffect(() => {
    if (connected && snapshot) {
      subscribe('spectator.subscribe', { matchId: snapshot.publicId })
    }
  }, [connected, snapshot, subscribe])

  // Timer countdown
  useEffect(() => {
    if (!snapshot?.endsAt) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(snapshot.endsAt!).getTime() - Date.now()) / 1000))
      setTimeLeft(remaining)
    }, 1000)
    return () => clearInterval(interval)
  }, [snapshot?.endsAt])

  if (error) return <ErrorState message={error} />
  if (!snapshot) return <Loading label="Connecting to arena" />

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1200px] space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <SectionTitle>
            LIVE {liveCodeAllowed ? '· DUEL' : ''} · {snapshot.stackName} · {snapshot.difficultyId}
          </SectionTitle>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            {spectatorCount > 0 && (
              <span>{spectatorCount} spectator{spectatorCount !== 1 ? 's' : ''}</span>
            )}
            {timeLeft !== null && (
              <span className="font-mono text-zinc-300">{formatTime(timeLeft)}</span>
            )}
            <span className={`px-2 py-0.5 rounded text-[0.6rem] uppercase font-medium ${
              snapshot.status === 'active' ? 'bg-emerald-900/30 text-emerald-400' :
              snapshot.status === 'resolved' ? 'bg-zinc-800 text-zinc-400' :
              'bg-amber-900/30 text-amber-400'
            }`}>
              {snapshot.status}
            </span>
          </div>
        </div>

        {/* Players */}
        <Panel>
          <div className="grid grid-cols-2 gap-4">
            {snapshot.participants.map((p) => (
              <div key={p.handle ?? 'p'} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">@{p.handle ?? '?'}</span>
                  {p.slot === 1 && <span className="text-[0.6rem] text-zinc-500 uppercase">P1</span>}
                  {p.slot === 2 && <span className="text-[0.6rem] text-zinc-500 uppercase">P2</span>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 bg-zinc-800 border border-zinc-700">
                    <div
                      className="h-full bg-zinc-400 transition-all"
                      style={{ width: `${Math.round((p.passedCount / Math.max(p.totalWeight, 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="label-mono w-20 shrink-0 text-right text-[0.6rem] text-zinc-500">
                    {p.attempts} submits
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Live Code (challenge matches only) */}
        {liveCodeAllowed && (
          <div className="grid grid-cols-2 gap-4">
            {snapshot.participants.map((p) => (
              <Panel key={p.slot} className="min-h-[300px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-300">@{p.handle}</span>
                  <span className="text-[0.6rem] text-emerald-400 uppercase font-medium">LIVE</span>
                </div>
                <pre className="font-mono text-xs leading-relaxed text-zinc-300 overflow-auto max-h-[400px] whitespace-pre-wrap">
                  {editors[p.slot] || '// Waiting for editor updates...'}
                </pre>
              </Panel>
            ))}
          </div>
        )}

        {/* Question */}
        <Panel className="max-h-[50vh] overflow-y-auto">
          <h3 className="font-mono text-sm font-bold">{snapshot.question.title}</h3>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-300">
            {snapshot.question.promptMd}
          </pre>
        </Panel>
      </main>
    </>
  )
}
