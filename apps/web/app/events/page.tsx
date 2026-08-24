'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type EventDto } from '@/lib/api'
import { useSession } from '@/lib/session'
import AppNav from '@/components/clutch/app-nav'
import EventCard from '@/components/clutch/event-card'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function EventsPage() {
  const { user } = useSession()
  const [events, setEvents] = useState<EventDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)
  /** Registration state per slug is authoritative server-side; we only track
   *  what this client has successfully done in this session. */
  const [registered, setRegistered] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ events: EventDto[] }>('/events')
      setEvents(res.events)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load events')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleRegistration(event: EventDto) {
    setBusySlug(event.slug)
    setError(null)
    try {
      if (registered.has(event.slug)) {
        await api.delete(`/events/${event.slug}/register`)
        setRegistered((s) => {
          const next = new Set(s)
          next.delete(event.slug)
          return next
        })
      } else {
        await api.post(`/events/${event.slug}/register`)
        setRegistered((s) => new Set(s).add(event.slug))
      }
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration action failed')
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[900px] space-y-8 px-4 py-8">
        <SectionTitle>Events</SectionTitle>
        <p className="-mt-3 text-xs text-muted-foreground">
          Start and end times come from the Clutch server clock — never your device.
        </p>

        {error ? <ErrorState message={error} /> : null}

        {!events ? (
          <Loading label="Loading events" />
        ) : events.length === 0 ? (
          <Panel className="label-mono text-xs text-muted-foreground">No events scheduled.</Panel>
        ) : (
          <div className="space-y-4">
            {events.map((e) => (
              <div key={e.id} className="space-y-2">
                <EventCard event={e} />
                <div className="flex flex-wrap items-center gap-4 px-1">
                  {e.phase === 'active' || e.phase === 'upcoming' ? (
                    user ? (
                      <button
                        onClick={() => void toggleRegistration(e)}
                        disabled={busySlug === e.slug}
                        className={`label-mono border px-4 py-1.5 text-[0.62rem] font-bold uppercase transition-colors ${
                          registered.has(e.slug)
                            ? 'border-red-400/60 text-red-300 hover:bg-red-400/10'
                            : 'border-border-strong bg-primary text-primary-foreground'
                        } disabled:opacity-50`}
                      >
                        {busySlug === e.slug
                          ? 'Working…'
                          : registered.has(e.slug)
                            ? 'Unregister'
                            : 'Register'}
                      </button>
                    ) : (
                      <span className="label-mono text-[0.62rem] text-muted-foreground">
                        Sign in to register.
                      </span>
                    )
                  ) : (
                    <span className="label-mono text-[0.62rem] uppercase text-muted-foreground/60">
                      Registration closed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
