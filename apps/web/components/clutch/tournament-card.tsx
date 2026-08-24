import type { TournamentDto } from '@/lib/api'

const STATUS_LABELS: Record<string, string> = {
  registration_open: 'Registration open',
  seeding: 'Seeding',
  running: 'Running',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
}

export function TournamentCard({ tournament }: { tournament: TournamentDto }) {
  const starts = new Date(tournament.startsAt)
  const closes = new Date(tournament.registrationClosesAt)
  return (
    <a
      href={`/tournaments/${tournament.slug}`}
      className="block border border-border bg-card/30 px-4 py-3 transition-colors hover:border-primary/60"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{tournament.name}</p>
          <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
            {tournament.format.replace(/_/g, ' ')} · {tournament.stackName} ·{' '}
            {tournament.registeredCount}/{tournament.maxParticipants} players
            {tournament.championHandle ? ` · champion @${tournament.championHandle}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="label-mono text-[0.65rem] font-black uppercase text-primary">
            {STATUS_LABELS[tournament.status] ?? tournament.status}
          </p>
          <p className="label-mono text-[0.6rem] text-muted-foreground">
            starts {starts.toLocaleDateString()} · reg. closes {closes.toLocaleDateString()}
          </p>
        </div>
      </div>
    </a>
  )
}

export default TournamentCard
