import type { EventDto } from '@/lib/api'
import { cn } from '@/lib/utils'

const PHASE_STYLES: Record<string, string> = {
  upcoming: 'text-muted-foreground',
  active: 'text-emerald-400',
  ended: 'text-muted-foreground/60',
}

export function EventCard({ event }: { event: EventDto }) {
  const starts = new Date(event.startsAt)
  const ends = new Date(event.endsAt)
  return (
    <a
      href={`/events/${event.slug}`}
      className="block border border-border bg-card/30 px-4 py-3 transition-colors hover:border-primary/60"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{event.name}</p>
          <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
            {event.stackIds.length > 0 ? event.stackIds.join(' / ') : 'all stacks'}
            {event.maxParticipants ? ` · max ${event.maxParticipants}` : ''}
            {event.registeredCount !== undefined ? ` · ${event.registeredCount} registered` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('label-mono text-[0.65rem] font-black uppercase', PHASE_STYLES[event.phase])}>
            {event.phase}
          </p>
          <p className="label-mono text-[0.6rem] text-muted-foreground">
            {starts.toLocaleDateString()} – {ends.toLocaleDateString()}
          </p>
        </div>
      </div>
    </a>
  )
}

export default EventCard
