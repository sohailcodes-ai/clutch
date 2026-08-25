'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, type TournamentBracketDto, type TournamentBracketNodeDto } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useWs } from '@/lib/ws'
import AppNav from '@/components/clutch/app-nav'
import { ErrorState, Loading, Panel } from '@/components/clutch/states'

const STATUS_LABELS: Record<string, string> = {
  registration_open: 'Registration Open',
  seeding: 'Seeding',
  running: 'Running',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
}

function BracketNode({ node }: { node: TournamentBracketNodeDto }) {
  const isWinnerA = node.winnerUserId && node.winnerUserId === node.participantAUserId
  const isWinnerB = node.winnerUserId && node.winnerUserId === node.participantBUserId
  const isActive = node.status === 'active'
  const isBye = node.status === 'bye'

  return (
    <div className={`border px-3 py-2 text-xs font-mono ${isActive ? 'border-primary bg-primary/5' : 'border-border bg-card/30'}`}>
      <div className={`mb-1 flex items-center justify-between gap-2 ${isWinnerA ? 'text-primary font-bold' : node.participantAUserId ? '' : 'text-muted-foreground'}`}>
        <span className="truncate">{node.participantAHandle ? `@${node.participantAHandle}` : 'TBD'}</span>
        {isWinnerA ? <span className="text-[0.55rem] uppercase">W</span> : null}
      </div>
      <div className={`flex items-center justify-between gap-2 ${isWinnerB ? 'text-primary font-bold' : node.participantBUserId ? '' : 'text-muted-foreground'}`}>
        <span className="truncate">
          {isBye && !node.participantBUserId ? 'BYE' : node.participantBHandle ? `@${node.participantBHandle}` : 'TBD'}
        </span>
        {isWinnerB ? <span className="text-[0.55rem] uppercase">W</span> : null}
      </div>
      {node.matchPublicId ? (
        <a href={`/matches/${node.matchPublicId}`} className="mt-1 block text-[0.55rem] text-muted-foreground underline hover:text-primary">
          view match
        </a>
      ) : null}
    </div>
  )
}

function BracketRound({ roundNumber, nodes, totalRounds }: { roundNumber: number; nodes: TournamentBracketNodeDto[]; totalRounds: number }) {
  const roundLabel = roundNumber === totalRounds ? 'Final' : roundNumber === totalRounds - 1 ? 'Semi-Final' : `Round ${roundNumber}`
  return (
    <div className="flex flex-col gap-2">
      <p className="label-mono text-[0.6rem] font-bold uppercase text-muted-foreground">{roundLabel}</p>
      {nodes.map((node) => (
        <BracketNode key={node.id} node={node} />
      ))}
    </div>
  )
}

export default function TournamentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { user } = useSession()
  const [bracket, setBracket] = useState<TournamentBracketDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [regBusy, setRegBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ bracket: TournamentBracketDto }>(`/tournaments/${slug}/bracket`)
      setBracket(res.bracket)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tournament')
    }
  }, [slug])

  useEffect(() => { void load() }, [load])

  const loadRef = useRef(load)
  loadRef.current = load

  // Subscribe to tournament WS events and refresh on bracket-relevant events
  const TOURNAMENT_EVENTS = new Set([
    'tournament.created', 'tournament.updated', 'tournament.started',
    'tournament.match_created', 'tournament.match_completed',
    'tournament.round_completed', 'tournament.player_eliminated',
    'tournament.completed', 'tournament.cancelled', 'tournament.snapshot',
  ])

  const { connected, subscribe } = useWs({
    onMessage: useCallback((msg: { type?: string; tournamentId?: string }) => {
      if (msg.type && TOURNAMENT_EVENTS.has(msg.type)) {
        void loadRef.current()
      }
    }, []),
  })

  // Subscribe to tournament channel once connected and bracket is loaded
  useEffect(() => {
    if (connected && bracket?.tournament?.id) {
      subscribe('tournament.subscribe', { slug })
    }
  }, [connected, subscribe, slug, bracket?.tournament?.id])

  async function register() {
    setRegBusy(true)
    setError(null)
    try {
      await api.post(`/tournaments/${slug}/register`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setRegBusy(false)
    }
  }

  async function unregister() {
    setRegBusy(true)
    setError(null)
    try {
      await api.delete(`/tournaments/${slug}/register`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unregister failed')
    } finally {
      setRegBusy(false)
    }
  }

  if (!bracket) return error ? <ErrorState message={error} onRetry={() => void load()} /> : <Loading />

  const { tournament, rounds, currentRoundNumber } = bracket
  const isRegistered = user != null
  const canRegister = tournament.status === 'registration_open'
  const isRunning = tournament.status === 'running'
  const totalRounds = rounds.length

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-8">
        {error ? <ErrorState message={error} /> : null}

        <Panel className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-mono text-lg">{tournament.name}</h1>
              <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
                {tournament.format.replace(/_/g, ' ')} · {tournament.stackName}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="label-mono text-[0.7rem] font-black uppercase text-primary">
                {STATUS_LABELS[tournament.status] ?? tournament.status}
              </p>
              {tournament.championHandle ? (
                <p className="label-mono text-[0.6rem] text-muted-foreground">Champion: @{tournament.championHandle}</p>
              ) : null}
            </div>
          </div>

          {tournament.descriptionMd ? (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{tournament.descriptionMd}</p>
          ) : null}

          <div className="flex flex-wrap gap-4 label-mono text-[0.6rem] text-muted-foreground">
            <span>{tournament.registeredCount}/{tournament.maxParticipants} players</span>
            <span>Starts: {new Date(tournament.startsAt).toLocaleDateString()}</span>
            <span>Reg closes: {new Date(tournament.registrationClosesAt).toLocaleDateString()}</span>
            {currentRoundNumber != null ? <span>Current round: {currentRoundNumber}</span> : null}
          </div>

          <div className="flex items-center gap-3">
            {canRegister ? (
              <button
                onClick={() => void register()}
                disabled={regBusy}
                className="label-mono border border-border-strong bg-primary px-4 py-1.5 text-[0.62rem] font-bold uppercase text-primary-foreground disabled:opacity-50"
              >
                {regBusy ? 'Registering…' : 'Register'}
              </button>
            ) : null}
            {tournament.status !== 'draft' && tournament.status !== 'registration_open' && isRegistered ? (
              <button
                onClick={() => void unregister()}
                disabled={regBusy}
                className="label-mono border border-border px-4 py-1.5 text-[0.62rem] uppercase text-muted-foreground hover:border-red-400 hover:text-red-400 disabled:opacity-50"
              >
                Unregister
              </button>
            ) : null}
          </div>
        </Panel>

        {isRunning || tournament.status === 'completed' ? (
          <div className="space-y-4">
            <p className="label-mono text-[0.65rem] font-bold uppercase text-muted-foreground">Bracket</p>
            <div className="flex gap-6 overflow-x-auto pb-4">
              {rounds.map((round) => (
                <BracketRound
                  key={round.roundId}
                  roundNumber={round.roundNumber}
                  nodes={round.nodes}
                  totalRounds={totalRounds}
                />
              ))}
            </div>
          </div>
        ) : (
          <Panel className="label-mono text-xs text-muted-foreground">
            Bracket will appear once the tournament starts.
          </Panel>
        )}
      </main>
    </>
  )
}
