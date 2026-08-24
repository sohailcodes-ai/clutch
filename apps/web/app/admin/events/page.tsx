'use client'

import { useEffect, useState } from 'react'
import { api, ApiError, type EventDto } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import EventCard from '@/components/clutch/event-card'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [stackIds, setStackIds] = useState('python')
  const [difficultyIds, setDifficultyIds] = useState('rookie')
  const [durationHours, setDurationHours] = useState(48)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const res = await api.get<{ events: EventDto[] }>('/events')
      setEvents(res.events)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load events')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const now = Date.now()
      await api.post('/admin/events', {
        slug,
        name,
        startsAt: new Date(now).toISOString(),
        endsAt: new Date(now + durationHours * 3600 * 1000).toISOString(),
        stackIds: stackIds.split(',').map((s) => s.trim()).filter(Boolean),
        allowedDifficultyIds: difficultyIds.split(',').map((s) => s.trim()).filter(Boolean),
      })
      setName('')
      setSlug('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create event')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-8">
        <SectionTitle>Events administration</SectionTitle>

        <Panel>
          <form onSubmit={createEvent} className="space-y-3">
            <p className="label-mono text-[0.65rem] uppercase text-muted-foreground">Create event</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} placeholder="Rookie Cup" className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
              <input value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" placeholder="rookie-cup" className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
              <input value={stackIds} onChange={(e) => setStackIds(e.target.value)} required placeholder="python, javascript" className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
              <input value={difficultyIds} onChange={(e) => setDifficultyIds(e.target.value)} required placeholder="rookie, starter" className="border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
              <label className="label-mono flex items-center gap-2 text-[0.62rem] uppercase text-muted-foreground">
                Duration (hours)
                <input type="number" min={1} max={720} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-24 border border-border bg-background px-2 py-1 font-mono text-sm" />
              </label>
            </div>
            <button disabled={busy} className="label-mono border border-border-strong bg-primary px-5 py-2 text-[0.66rem] font-bold uppercase text-primary-foreground disabled:opacity-50">
              {busy ? 'Creating…' : 'Create & publish'}
            </button>
          </form>
        </Panel>

        {error ? <ErrorState message={error} /> : null}

        {!events ? (
          <Loading />
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
