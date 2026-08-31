'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError, type RunResultDto } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useWs, type ConnectionStatus } from '@/lib/ws'
import AppNav from '@/components/clutch/app-nav'
import SubmissionStateChip, { type SubmissionState } from '@/components/clutch/submission-state'
import ConnectionIndicator from '@/components/clutch/connection-indicator'
import MatchSkeleton from '@/components/clutch/match-skeleton'
import ClutchLogo from '@/components/brand/clutch-logo'
import { ErrorState, Panel, SectionTitle } from '@/components/clutch/states'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Participant = {
  userId: string
  handle: string | null
  avatarUrl: string | null
  slot: number
  ratingBefore: number
  ratingAfter: number | null
  result: string | null
}

type MatchSnapshot = {
  id: string
  publicId: string
  status: string
  stackId: string
  difficultyId: string
  timeLimitSec: number
  startedAt: string | null
  endsAt: string | null
  winnerUserId: string | null
  resolveReason?: string | null
  opponent?: { handle: string | null; avatarUrl: string | null; ratingBefore: number } | null
  questionVersion: {
    id: string
    version: number
    promptMd: string
    examples: unknown[]
    starterCode: Record<string, string>
    testCases: { ordinal: number; input: string; expectedOutput: string; visibility: string }[]
  }
  submissions: {
    id: string
    status: SubmissionState
    passedCount: number
    totalCount: number
    isFinal: boolean
    createdAt: string
  }[]
  participants: Participant[]
  viewerCompetitive?: {
    competitiveStatus: 'unranked' | 'ranked'
    placementMatchesRequired: number
    placementMatchesCompleted: number
    placementRemaining: number
  } | null
}

/** All WS event types that should trigger a match snapshot refresh. */
const MATCH_EVENTS = new Set([
  'match.found',
  'match.starting',
  'match.active',
  'match.participant_update',
  'submission.queued',
  'match.evaluating',
  'submission.result',
  'match.resolved',
  'match.adjudicated',
  'match.snapshot',
  'admin.joined',
  'admin.left',
])

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Safe, user-facing error messages keyed by API error code or message pattern. */
function friendlyError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.'
  const msg = err.message.toLowerCase()
  if (err.status === 401 || err.status === 403) return 'Your session has expired. Please sign in again.'
  if (err.status === 404) return 'This match is no longer available.'
  if (err.status === 409) return 'Match state has changed. Refreshing…'
  if (msg.includes('network') || msg.includes('fetch')) return 'Connection lost. Trying to reconnect…'
  if (msg.includes('submission') || msg.includes('code')) return 'Submission could not be evaluated. Try again.'
  if (msg.includes('not active')) return 'This match is no longer active.'
  return err.message || 'Something went wrong. Please try again.'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Timer({ endsAt, now }: { endsAt: string | null; now: number }) {
  const remaining = useMemo(() => {
    if (!endsAt) return null
    return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000))
  }, [endsAt, now])
  const urgent = remaining !== null && remaining <= 120

  if (remaining === null) return null
  return (
    <div className="text-right" role="timer" aria-label={`Time remaining ${remaining} seconds`}>
      <p
        className={cn(
          'data-mono text-3xl font-black tabular-nums leading-none sm:text-4xl',
          urgent ? 'animate-pulse text-defeat' : 'text-primary',
        )}
      >
        {String(Math.floor(remaining / 60)).padStart(2, '0')}:
        {String(remaining % 60).padStart(2, '0')}
      </p>
      <p className="label-mono mt-1 text-[0.55rem] uppercase text-muted-foreground">
        server clock
      </p>
    </div>
  )
}

function PlayerIdentity({
  handle,
  avatarUrl,
  rating,
  align = 'left',
  showYou = false,
}: {
  handle: string | null
  avatarUrl: string | null
  rating?: number | null
  align?: 'left' | 'right'
  showYou?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', align === 'right' && 'flex-row-reverse')}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="size-9 border border-border object-cover" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center border border-border text-[0.62rem] font-black text-muted-foreground">
          {(handle ?? '?').slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className={cn('min-w-0', align === 'right' && 'text-right')}>
        <p className="truncate font-mono text-sm font-bold">
          @{handle ?? '?'}
          {showYou ? (
            <span className="label-mono ml-1.5 text-[0.55rem] normal-case text-muted-foreground">(you)</span>
          ) : null}
        </p>
        {rating !== undefined && rating !== null ? (
          <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">{rating} rating</p>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useSession()

  // Server-authoritative match snapshot
  const [match, setMatch] = useState<MatchSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)

  // Editor state
  const [code, setCode] = useState('')
  const codeRef = useRef('')
  codeRef.current = code

  // Timer
  const [now, setNow] = useState(() => Date.now())

  // Ready state
  const [readyBusy, setReadyBusy] = useState(false)
  const [readyConfirmed, setReadyConfirmed] = useState(false)

  // Submission / run state
  const [submitBusy, setSubmitBusy] = useState(false)
  const [runBusy, setRunBusy] = useState(false)
  const [runResult, setRunResult] = useState<RunResultDto | null>(null)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)

  // Forfeit state
  const [forfeitBusy, setForfeitBusy] = useState(false)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)

  // ---- Load match snapshot from API ----
  const load = useCallback(async () => {
    try {
      const res = await api.get<{ match: MatchSnapshot }>(`/matches/${id}`)
      setMatch(res.match)
      setCode((prev) => {
        if (prev) return prev
        const starters = res.match.questionVersion.starterCode
        return starters[res.match.stackId] ?? Object.values(starters)[0] ?? ''
      })
      // If the match is already starting/active when we load, the viewer has
      // already readied (e.g. after a page refresh during ready phase).
      // We cannot assume this from local state — the server decides.
      // The readyConfirmed flag is set by the ready() function, not by load.
      setError(null)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setInitialLoading(false)
    }
  }, [id])

  // Keep a ref so the WS handler always calls the latest load.
  const loadRef = useRef(load)
  loadRef.current = load

  // Timer tick (1s, independent of WS).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // ---- WebSocket ----
  const lastEventIdRef = useRef<number | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')

  const { status: wsStatus, subscribe } = useWs({
    onMessage: useCallback(
      (msg: { type?: string; matchId?: string; id?: string }) => {
        if (msg.type && MATCH_EVENTS.has(msg.type) && msg.matchId === id) {
          void loadRef.current()
        }
        // Track last event ID for resync
        if (msg.id) {
          const num = parseInt(msg.id.replace(/^evt-/, ''), 10)
          if (!isNaN(num)) lastEventIdRef.current = num
        }
      },
      [id],
    ),
  })

  // Sync connection status
  useEffect(() => {
    setConnectionStatus(wsStatus)
  }, [wsStatus])

  // Subscribe + resync on connect/reconnect
  useEffect(() => {
    if (wsStatus === 'connected') {
      subscribe('match.subscribe', { matchId: id })
    }
  }, [wsStatus, subscribe, id])

  // ---- Initial load ----
  useEffect(() => {
    void load()
  }, [load])

  // ---- Actions ----

  async function ready() {
    if (readyBusy || readyConfirmed) return
    setReadyBusy(true)
    setError(null)
    try {
      await api.post(`/matches/${id}/ready`)
      setReadyConfirmed(true)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setReadyBusy(false)
    }
  }

  async function testRun() {
    if (runBusy) return
    setRunBusy(true)
    setRunResult(null)
    setSubmitMsg(null)
    setError(null)
    try {
      const res = await api.post<RunResultDto>(`/matches/${id}/run`, {
        sourceCode: codeRef.current,
        stdin: '',
        stackId: match?.stackId ?? '',
      })
      setRunResult(res)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setRunBusy(false)
    }
  }

  async function submitFinal() {
    if (submitBusy) return
    setSubmitBusy(true)
    setSubmitMsg(null)
    setRunResult(null)
    setError(null)
    try {
      await api.post(`/matches/${id}/submissions`, {
        sourceCode: codeRef.current,
        isFinal: true,
        idempotencyKey: crypto.randomUUID(),
      })
      setSubmitMsg('Final submission queued for evaluation.')
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitBusy(false)
    }
  }

  async function forfeit() {
    if (forfeitBusy) return
    setForfeitBusy(true)
    setShowForfeitConfirm(false)
    setError(null)
    try {
      await api.post(`/matches/${id}/forfeit`)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setForfeitBusy(false)
    }
  }

  // ---- Derived state ----
  const viewerId = user?.id ?? ''
  const viewer = match?.participants.find((p) => p.userId === viewerId)
  const opponentParticipant = match?.participants.find((p) => p.userId !== viewerId)
  const latest = match?.submissions[match.submissions.length - 1]
  const isResult = match
    ? ['resolved', 'draw', 'abandoned', 'cancelled'].includes(match.status)
    : false
  const isLobby = match ? ['matched', 'starting'].includes(match.status) : false
  const isActive = match ? ['active', 'evaluating'].includes(match.status) : false
  const isEvaluating = match?.status === 'evaluating'
  const isFinished = match?.status === 'resolved' || match?.status === 'draw'

  // ---- Render: initial loading ----
  if (initialLoading && !match && !error) {
    return (
      <>
        <AppNav />
        <MatchSkeleton />
      </>
    )
  }

  // ---- Render: error with no match ----
  if (error && !match) {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-[720px] px-4 py-12">
          <ErrorState message={error} onRetry={() => { setError(null); setInitialLoading(true); void load() }} />
        </main>
      </>
    )
  }

  if (!match) return null

  // ============================================================
  // RESULT SCREEN (resolved | draw | abandoned | cancelled)
  // ============================================================
  if (isResult) {
    const myResult =
      viewer?.result === 'win' || viewer?.result === 'loss' || viewer?.result === 'draw'
        ? viewer.result
        : match.status === 'draw'
          ? 'draw'
          : null
    const headline =
      myResult === 'win' ? 'VICTORY' : myResult === 'loss' ? 'DEFEAT' : 'DRAW'
    const delta =
      viewer?.ratingAfter !== null && viewer?.ratingAfter !== undefined && viewer
        ? viewer.ratingAfter - viewer.ratingBefore
        : null
    const inPlacement = match.viewerCompetitive?.competitiveStatus === 'unranked'
    const placementDone = match.viewerCompetitive?.placementMatchesCompleted ?? 0
    const placementTotal = match.viewerCompetitive?.placementMatchesRequired ?? 0
    const placementLeft = match.viewerCompetitive?.placementRemaining ?? 0

    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-[720px] space-y-6 px-4 py-12">
          <div className="border border-border bg-card/40 p-8 text-center sm:p-12">
            <ClutchLogo size={22} label="" className="mx-auto mb-6 text-primary/70" />

            {inPlacement ? (
              <p className="label-mono mb-4 border border-warning/50 px-3 py-1 inline-block text-[0.62rem] font-black uppercase text-warning">
                Placement match {placementDone} / {placementTotal}
              </p>
            ) : null}

            <h1
              className={cn(
                'text-display text-5xl sm:text-7xl',
                myResult === 'win'
                  ? 'text-victory'
                  : myResult === 'loss'
                    ? 'text-defeat'
                    : 'text-foreground',
              )}
              role="heading"
              aria-level={1}
            >
              {headline}
            </h1>

            {delta !== null && delta !== 0 ? (
              <p
                className={cn(
                  'data-mono mt-4 text-2xl font-black',
                  delta > 0 ? 'text-victory' : 'text-defeat',
                )}
                aria-label={`Rating change: ${delta > 0 ? 'plus' : 'minus'} ${Math.abs(delta)}`}
              >
                {delta > 0 ? '+' : ''}
                {delta} Rating
              </p>
            ) : (
              <p className="label-mono mt-4 text-xs text-muted-foreground">Unrated match</p>
            )}

            {viewer?.ratingAfter !== null && viewer?.ratingAfter != null ? (
              <p className="data-mono mt-2 text-sm text-muted-foreground">
                {viewer.ratingBefore} → {viewer.ratingAfter}
              </p>
            ) : null}

            {inPlacement ? (
              <p className="label-mono mt-4 text-[0.62rem] uppercase text-muted-foreground">
                {placementLeft > 0
                  ? `Clutch is calibrating your rating — ${placementLeft} placement ${placementLeft === 1 ? 'match' : 'matches'} remaining.`
                  : 'Placement complete — you are now ranked.'}
              </p>
            ) : null}

            {match.resolveReason === 'forfeit' ? (
              <p className="label-mono mt-3 text-[0.62rem] uppercase text-warning">
                Result determined by forfeit
              </p>
            ) : null}

            <div className="mx-auto mt-8 grid max-w-sm grid-cols-3 gap-px border border-border bg-border">
              <div className="bg-background p-3">
                <p className="label-mono text-[0.55rem] text-muted-foreground">You</p>
                <p className="mt-1 truncate font-mono text-xs">@{viewer?.handle ?? '?'}</p>
              </div>
              <div className="bg-background p-3">
                <p className="label-mono text-[0.55rem] text-muted-foreground">Opponent</p>
                <p className="mt-1 truncate font-mono text-xs">@{opponentParticipant?.handle ?? '?'}</p>
              </div>
              <div className="bg-background p-3">
                <p className="label-mono text-[0.55rem] text-muted-foreground">Stack</p>
                <p className="mt-1 font-mono text-xs">{match.stackId}</p>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => router.push('/home')}
                autoFocus
                className="label-mono border border-border-strong bg-primary px-8 py-3 text-[0.7rem] font-bold uppercase text-primary-foreground transition-opacity hover:opacity-90"
              >
                Play Again
              </button>
              <button
                onClick={() => router.push(`/profile/${viewer?.handle ?? ''}`)}
                className="label-mono border border-border-strong px-8 py-3 text-[0.7rem] font-bold uppercase text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                View Profile
              </button>
            </div>
          </div>
        </main>
      </>
    )
  }

  // ============================================================
  // LOBBY / VS SCREEN (matched | starting)
  // ============================================================
  if (isLobby) {
    const isStarting = match.status === 'starting'
    const readyWindowSec = 30

    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-[900px] space-y-4 px-4 py-8 sm:py-12">
          {/* Connection indicator */}
          <div className="flex justify-end">
            <ConnectionIndicator status={connectionStatus} />
          </div>

          <Panel className="border-primary/40 p-8 sm:p-12">
            <SectionTitle>
              {match.viewerCompetitive?.competitiveStatus === 'unranked'
                ? `Placement match ${Math.min(match.viewerCompetitive.placementMatchesCompleted + 1, match.viewerCompetitive.placementMatchesRequired)} / ${match.viewerCompetitive.placementMatchesRequired}`
                : 'Finding start'}{' '}
              · {match.publicId}
            </SectionTitle>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-8 sm:gap-8">
              <div>
                <PlayerIdentity
                  handle={viewer?.handle ?? null}
                  avatarUrl={viewer?.avatarUrl ?? null}
                  rating={
                    match.viewerCompetitive?.competitiveStatus === 'ranked'
                      ? viewer?.ratingBefore
                      : null
                  }
                  showYou
                />
                {match.viewerCompetitive?.competitiveStatus === 'unranked' ? (
                  <p className="label-mono mt-1 border border-warning/50 px-1.5 py-0.5 inline-block text-[0.55rem] font-black uppercase text-warning">
                    Unranked · Placement {match.viewerCompetitive.placementMatchesCompleted}/
                    {match.viewerCompetitive.placementMatchesRequired}
                  </p>
                ) : null}
              </div>
              <div className="text-center">
                <p className="text-display text-3xl text-primary sm:text-5xl">VS</p>
                <p className="label-mono mt-2 text-[0.55rem] uppercase text-muted-foreground">
                  {match.stackId} · {match.difficultyId}
                </p>
              </div>
              <PlayerIdentity
                handle={match.opponent?.handle ?? opponentParticipant?.handle ?? null}
                avatarUrl={match.opponent?.avatarUrl ?? opponentParticipant?.avatarUrl ?? null}
                rating={match.opponent?.ratingBefore ?? opponentParticipant?.ratingBefore}
                align="right"
              />
            </div>

            {/* Status message */}
            {isStarting ? (
              <p className="label-mono mb-4 text-center text-[0.62rem] uppercase text-warning animate-pulse">
                Opponent is ready — {readyWindowSec}s window to lock in
              </p>
            ) : (
              <p className="label-mono mb-4 text-center text-[0.58rem] text-muted-foreground">
                The duel starts when both players are locked in.
              </p>
            )}

            {/* Ready button */}
            {readyConfirmed ? (
              <div className="mx-auto flex w-full max-w-xs items-center justify-center border border-victory/40 bg-victory/5 py-4">
                <p className="label-mono text-[0.65rem] uppercase text-victory">
                  ✓ Locked in — waiting for opponent
                </p>
              </div>
            ) : (
              <button
                onClick={() => void ready()}
                disabled={readyBusy}
                autoFocus
                aria-label="Ready up for the match"
                className="label-mono mx-auto flex w-full max-w-xs items-center justify-center border border-border-strong bg-primary py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {readyBusy ? 'Locking in…' : 'Ready up'}
              </button>
            )}

            {error ? (
              <p className="label-mono mt-4 text-center text-[0.62rem] text-defeat" role="alert">
                {error}
              </p>
            ) : null}
          </Panel>
        </main>
      </>
    )
  }

  // ============================================================
  // ACTIVE DUEL (active | evaluating)
  // ============================================================
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-4 sm:py-6">
        {/* Competitive header */}
        <Panel className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <PlayerIdentity
              handle={viewer?.handle ?? null}
              avatarUrl={viewer?.avatarUrl ?? null}
              showYou
            />
            <span className="text-display shrink-0 text-lg text-muted-foreground/60">VS</span>
            <PlayerIdentity
              handle={match.opponent?.handle ?? opponentParticipant?.handle ?? null}
              avatarUrl={match.opponent?.avatarUrl ?? opponentParticipant?.avatarUrl ?? null}
              align="right"
            />
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-right">
              <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">
                {match.publicId} · {match.stackId} · {match.difficultyId}
              </p>
              <div className="mt-1 flex items-center justify-end gap-2">
                {latest ? <SubmissionStateChip state={latest.status} /> : null}
                <ConnectionIndicator status={connectionStatus} />
              </div>
            </div>
            <Timer endsAt={match.endsAt} now={now} />
          </div>
        </Panel>

        {/* Evaluating banner */}
        {isEvaluating ? (
          <div
            className="border border-warning/40 bg-warning/5 px-4 py-2 text-center"
            role="status"
            aria-live="polite"
          >
            <p className="label-mono animate-pulse text-[0.62rem] uppercase text-warning">
              Evaluating final submissions — results incoming…
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
          {/* Problem panel */}
          <Panel className="max-h-[72vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-mono text-sm font-bold">
                {match.questionVersion.promptMd.split('\n')[0]?.replace(/^#+\s*/, '')}
              </h2>
              <span className="label-mono shrink-0 text-[0.55rem] uppercase text-muted-foreground">
                v{match.questionVersion.version} · {match.timeLimitSec}s limit
              </span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {match.questionVersion.promptMd.replace(/^#.*\n/, '')}
            </pre>
            {Array.isArray(match.questionVersion.examples) &&
            match.questionVersion.examples.length > 0 ? (
              <div className="mt-5 space-y-3">
                {(match.questionVersion.examples as { input?: string; output?: string }[]).map(
                  (ex, i) => (
                    <div key={i} className="border border-border/60 bg-background/60 p-3 font-mono text-xs">
                      <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">Input</p>
                      <pre className="mt-1 whitespace-pre-wrap">{ex.input}</pre>
                      <p className="label-mono mt-2 text-[0.55rem] uppercase text-muted-foreground">Output</p>
                      <pre className="mt-1 whitespace-pre-wrap">{ex.output}</pre>
                    </div>
                  ),
                )}
              </div>
            ) : null}
            <p className="label-mono mt-5 text-[0.55rem] text-muted-foreground/60">
              Hidden tests are judged server-side after your final submit.
            </p>
          </Panel>

          {/* Editor + submissions */}
          <div className="space-y-4">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              aria-label="Code editor"
              placeholder="Write your solution here…"
              className="h-[48vh] w-full resize-none border border-border bg-background p-4 font-mono text-xs leading-relaxed outline-none focus:border-primary lg:h-[54vh]"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void testRun()}
                disabled={runBusy || !isActive}
                aria-label="Test run your code against public test cases"
                className="label-mono border border-border-strong px-5 py-2.5 text-[0.65rem] uppercase transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
              >
                {runBusy ? 'Running…' : 'Test run'}
              </button>
              <button
                onClick={() => void submitFinal()}
                disabled={submitBusy || !isActive}
                aria-label="Submit your final solution"
                className="label-mono border border-border-strong bg-primary px-6 py-2.5 text-[0.65rem] font-bold uppercase text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitBusy ? 'Submitting…' : 'Final submit'}
              </button>
              <button
                onClick={() => setShowForfeitConfirm(true)}
                disabled={forfeitBusy || !isActive}
                aria-label="Forfeit this match"
                className="label-mono border border-border px-4 py-2.5 text-[0.65rem] uppercase text-muted-foreground transition-colors hover:border-defeat hover:text-defeat disabled:opacity-40"
              >
                Forfeit
              </button>
              {submitMsg ? (
                <span className="label-mono text-[0.6rem] text-signal" role="status">{submitMsg}</span>
              ) : null}
            </div>

            {/* Forfeit confirmation dialog */}
            {showForfeitConfirm ? (
              <div className="flex items-center gap-3 border border-defeat/40 bg-defeat/5 px-4 py-3" role="alertdialog" aria-label="Confirm forfeit">
                <p className="label-mono text-[0.62rem] text-defeat">Forfeit? Your opponent will win by default.</p>
                <button
                  onClick={() => void forfeit()}
                  disabled={forfeitBusy}
                  className="label-mono border border-defeat px-3 py-1 text-[0.6rem] uppercase text-defeat transition-colors hover:bg-defeat/10 disabled:opacity-50"
                >
                  {forfeitBusy ? 'Forfeiting…' : 'Yes, forfeit'}
                </button>
                <button
                  onClick={() => setShowForfeitConfirm(false)}
                  className="label-mono border border-border px-3 py-1 text-[0.6rem] uppercase text-muted-foreground transition-colors hover:border-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : null}

            {/* Run output panel */}
            {runResult ? (
              <Panel className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <SectionTitle>Output</SectionTitle>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'label-mono text-[0.58rem] uppercase',
                        runResult.status === 'accepted' ? 'text-signal' : 'text-defeat',
                      )}
                    >
                      {runResult.status.replace(/_/g, ' ')}
                    </span>
                    <span className="label-mono text-[0.55rem] text-muted-foreground">
                      {runResult.executionTimeMs}ms
                    </span>
                    {runResult.exitCode !== 0 ? (
                      <span className="label-mono text-[0.55rem] text-muted-foreground">
                        exit {runResult.exitCode}
                      </span>
                    ) : null}
                    {runResult.timedOut ? (
                      <span className="label-mono text-[0.55rem] text-defeat">timeout</span>
                    ) : null}
                  </div>
                </div>
                {runResult.stdout ? (
                  <div>
                    <p className="label-mono mb-1 text-[0.55rem] uppercase text-muted-foreground">stdout</p>
                    <pre className="max-h-[24vh] overflow-auto whitespace-pre-wrap border border-border/60 bg-background/60 p-3 font-mono text-xs leading-relaxed">
                      {runResult.stdout}
                    </pre>
                  </div>
                ) : null}
                {runResult.stderr ? (
                  <div>
                    <p className="label-mono mb-1 text-[0.55rem] uppercase text-muted-foreground">stderr</p>
                    <pre className="max-h-[16vh] overflow-auto whitespace-pre-wrap border border-defeat/30 bg-defeat/5 p-3 font-mono text-xs leading-relaxed text-defeat">
                      {runResult.stderr}
                    </pre>
                  </div>
                ) : null}
                {!runResult.stdout && !runResult.stderr ? (
                  <p className="text-xs text-muted-foreground">No output.</p>
                ) : null}
              </Panel>
            ) : null}

            {/* Submission history */}
            <Panel>
              <SectionTitle>Submissions</SectionTitle>
              {match.submissions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nothing submitted yet. Use &quot;Test run&quot; to sanity-check, then &quot;Final submit&quot; to lock
                  your solution.
                </p>
              ) : (
                <ul className="space-y-1.5" aria-label="Submission history">
                  {[...match.submissions].reverse().map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <SubmissionStateChip state={s.status} />
                        {s.isFinal ? (
                          <span className="label-mono text-[0.55rem] uppercase text-primary font-bold">final</span>
                        ) : null}
                      </div>
                      <span className="data-mono text-[0.65rem] text-muted-foreground">
                        {s.passedCount}/{s.totalCount} tests ·{' '}
                        {new Date(s.createdAt).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {error ? (
              <div className="border border-defeat/40 bg-defeat/5 px-4 py-3" role="alert">
                <p className="label-mono text-[0.62rem] text-defeat">{error}</p>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </>
  )
}
