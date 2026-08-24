'use client'

import { useEffect, useState } from 'react'
import { api, ApiError, type TournamentDto } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import TournamentCard from '@/components/clutch/tournament-card'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', stackId: 'typescript', maxParticipants: 16 })

  async function load() {
    try {
      const res = await api.get<{ tournaments: TournamentDto[] }>('/tournaments')
      setTournaments(res.tournaments)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tournaments')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const now = Date.now()
      await api.post('/admin/tournaments', {
        slug: form.slug,
        name: form.name,
        stackId: form.stackId,
        maxParticipants: form.maxParticipants,
        registrationOpensAt: new Date(now).toISOString(),
        registrationClosesAt: new Date(now + 3 * 86400000).toISOString(),
        startsAt: new Date(now + 4 * 86400000).toISOString(),
      })
      setForm({ ...form, name: '', slug: '' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create tournament')
    }
  }

  async function seedRounds(slug: string) {
    setBusySlug(slug)
    setError(null)
    try {
      await api.post(`/admin/tournaments/${slug}/seed-rounds`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Seeding failed')
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-8">
        <SectionTitle>Tournaments administration</SectionTitle>

        <Panel>
          <form onSubmit={create} className="space-y-3">
            <p className="label-mono text-[0.65rem] uppercase text-muted-foreground">Create tournament</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={3} placeholder="Clutch Open #02" className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required pattern="[a-z0-9-]+" placeholder="clutch-open-02" className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
              <input value={form.stackId} onChange={(e) => setForm({ ...form, stackId: e.target.value })} required placeholder="typescript" className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
              <input type="number" min={4} max={1024} value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) })} className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
            </div>
            <button className="label-mono border border-border-strong bg-primary px-5 py-2 text-[0.66rem] font-bold uppercase text-primary-foreground">
              Create (registration open)
            </button>
          </form>
        </Panel>

        {error ? <ErrorState message={error} /> : null}

        {!tournaments ? (
          <Loading />
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <div key={t.id}>
                <TournamentCard tournament={t} />
                {t.status === 'seeding' || t.status === 'registration_open' ? (
                  <button
                    onClick={() => void seedRounds(t.slug)}
                    disabled={busySlug === t.slug}
                    className="label-mono mt-1 border border-border px-3 py-1.5 text-[0.6rem] uppercase transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                  >
                    Seed bracket rounds
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
