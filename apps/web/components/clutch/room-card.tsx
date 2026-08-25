import type { RoomListItemDto, RoomDetailDto } from '@/lib/api'

/** Compact room card for lists (Explore / Rooms index). */
export function RoomCard({ room }: { room: RoomListItemDto }) {
  return (
    <a
      href={`/rooms/${room.id}`}
      className="flex items-center justify-between border border-border bg-card/30 px-4 py-3 transition-colors hover:border-primary/60"
    >
      <div className="min-w-0">
        <p className="truncate font-mono text-sm">{room.name}</p>
        <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
          {room.stackName} · {room.difficultyLabel ?? 'any difficulty'}
          {room.ranked ? ' · ranked' : ' · unranked'}
        </p>
      </div>
      <span className="label-mono shrink-0 text-xs text-muted-foreground">
        {room.playerCount}/{room.maxPlayers} players
      </span>
    </a>
  )
}

/** Full detail card used inside a room page. */
export function RoomDetailCard({ room }: { room: RoomDetailDto }) {
  return (
    <div className="border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold">{room.name}</h1>
          {room.description ? (
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{room.description}</p>
          ) : null}
          <p className="label-mono mt-1 text-[0.65rem] uppercase text-muted-foreground">
            {room.publicId} · host @{room.hostHandle ?? '?'}
          </p>
        </div>
        <div className="label-mono space-y-0.5 text-right text-[0.65rem] uppercase text-muted-foreground">
          <p>{room.stackName}</p>
          <p>{room.difficultyLabel ?? 'any difficulty'}</p>
          <p>{room.ranked ? 'ranked' : 'unranked'} · {room.timeLimitSec}s</p>
          <p>{room.isPublic ? 'public' : 'private'} · {room.status}</p>
          {room.lockedAt ? <p>locked at {new Date(room.lockedAt).toLocaleTimeString()}</p> : null}
        </div>
      </div>

      <ul className="mt-5 divide-y divide-border/60 border-t border-border/60 pt-2">
        {room.players.map((p) => (
          <li key={p.handle ?? p.joinedAt} className="flex items-center justify-between py-2">
            <span className="font-mono text-sm">@{p.handle ?? 'player'}</span>
            <span className="label-mono flex items-center gap-2 text-[0.6rem] uppercase text-muted-foreground">
              {p.isHost ? <span className="text-primary">host</span> : p.role === 'spectator' ? 'spectator' : ''}
              {p.readyAt ? (
                <span className="bg-primary/15 px-1.5 py-0.5 text-primary">ready</span>
              ) : (
                <span>not ready</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {room.joinCode ? (
        <p className="label-mono mt-4 border border-border bg-background px-3 py-2 text-[0.7rem]">
          Join code: <span className="font-bold tracking-widest text-primary">{room.joinCode}</span>
          <span className="ml-2 normal-case text-muted-foreground">(share privately)</span>
        </p>
      ) : null}
    </div>
  )
}

export default RoomCard
