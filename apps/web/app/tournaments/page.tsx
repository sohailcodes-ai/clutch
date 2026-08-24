'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type TournamentDto } from '@/lib/api'
import AppNav from '@/components/clutch/app-nav'
import TournamentCard from '@/components/clutch/tournament-card'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ tournaments: TournamentDto[] }>('/tournaments')
      setTournaments(res.tournaments)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tournaments')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function register(slug: string) {
    setBusySlug(slug)
    setError(null)
    try {
      await api.post(`/tournaments/${slug}/register`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[900px] space-y-6 px-4 py-8">
        <SectionTitle>Tournaments</SectionTitle>
        <p className="-mt-3 text-xs text-muted-foreground">
          Registration windows and capacity are enforced by the server.
        </p>

        {error ? <ErrorState message={error} /> : null}

        {!tournaments ? (
          <Loading label="Loading tournaments" />
        ) : tournaments.length === 0 ? (
          <Panel className="label-mono text-xs text-muted-foreground">No tournaments yet.</Panel>
        ) : (
          <div className="space-y-4">
            {tournaments.map((t) => (
              <div key={t.id} className="space-y-2">
                <TournamentCard tournament={t} />
                {t.status === 'registration_open' ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => void register(t.slug)}
                      disabled={busySlug === t.slug}
                      className="label-mono border border-border-strong bg-primary px-4 py-1.5 text-[0.62rem] font-bold uppercase text-primary-foreground disabled:opacity-50"
                    >
                      {busySlug === t.slug ? 'Registering…' : 'Register'}
                    </button>
                    <a
                      href={`/tournaments/${t.slug}`}
                      className="label-mono text-[0.62rem] uppercase text-muted-foreground underline hover:text-primary"
                    >
                      Details
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
