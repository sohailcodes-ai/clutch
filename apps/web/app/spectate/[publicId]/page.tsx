'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import AppNav from '@/components/clutch/app-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

type SpectatorSnapshot = {
  publicId: string
  status: string
  stackName: string
  difficultyId: string
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
  }[]
}

/**
 * Spectator view. Shows only what the server explicitly exposes to
 * non-participants — never source code or hidden tests.
 */
export default function SpectatePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params)
  const [snapshot, setSnapshot] = useState<SpectatorSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ match: SpectatorSnapshot }>(`/spectate/${publicId}`)
      setSnapshot(res.match)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Match not found')
    }
  }, [publicId])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 5000)
    return () => clearInterval(t)
  }, [load])

  if (error) return <ErrorState message={error} />
  if (!snapshot) return <Loading label="Connecting to arena" />

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-8">
        <SectionTitle>
          Live · {snapshot.stackName} · {snapshot.difficultyId}
        </SectionTitle>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-sm font-bold">
              {snapshot.participants.map((p) => `@${p.handle ?? '?'}`).join(' vs ')}
            </p>
            <p className="label-mono text-[0.65rem] uppercase text-muted-foreground">
              status {snapshot.status}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {snapshot.participants.map((p) => (
              <div key={p.handle ?? 'p'} className="flex items-center gap-3">
                <span className="w-40 truncate font-mono text-xs">@{p.handle ?? '?'}</span>
                <div className="h-2 flex-1 border border-border">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.round((p.passedCount / Math.max(p.totalWeight, 1)) * 100)}%` }}
                  />
                </div>
                <span className="label-mono w-20 shrink-0 text-right text-[0.6rem] text-muted-foreground">
                  {p.attempts} submits
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="max-h-[50vh] overflow-y-auto">
          <h3 className="font-mono text-sm font-bold">{snapshot.question.title}</h3>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed">
            {snapshot.question.promptMd}
          </pre>
        </Panel>
      </main>
    </>
  )
}
