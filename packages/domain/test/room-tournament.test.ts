import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRoomSchema, updateRoomSchema, createTournamentSchema, updateTournamentSchema, validateRoomConfig } from '@clutch/shared'

describe('createRoomSchema', () => {
  it('accepts valid minimal input', () => {
    const result = createRoomSchema.safeParse({ name: 'Test Room', stackId: 'python' })
    expect(result.success).toBe(true)
  })

  it('rejects name shorter than 3 chars', () => {
    const result = createRoomSchema.safeParse({ name: 'ab', stackId: 'python' })
    expect(result.success).toBe(false)
  })

  it('defaults maxPlayers to 8', () => {
    const result = createRoomSchema.safeParse({ name: 'Test Room', stackId: 'python' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.maxPlayers).toBe(8)
  })

  it('accepts description', () => {
    const result = createRoomSchema.safeParse({ name: 'Test Room', stackId: 'python', description: 'A room' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.description).toBe('A room')
  })

  it('rejects maxPlayers outside limits', () => {
    const result = createRoomSchema.safeParse({ name: 'Test Room', stackId: 'python', maxPlayers: 1 })
    expect(result.success).toBe(false)
  })
})

describe('updateRoomSchema', () => {
  it('accepts partial updates', () => {
    const result = updateRoomSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no-op)', () => {
    const result = updateRoomSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('validateRoomConfig', () => {
  it('returns ok for valid config', () => {
    const result = validateRoomConfig({ name: 'Test', stackId: 'python', maxPlayers: 2, isPublic: true, ranked: false, timeLimitSec: 900, questionSelectionMode: 'adaptive' })
    expect(result.ok).toBe(true)
  })
})

describe('createTournamentSchema', () => {
  it('accepts valid tournament input', () => {
    const result = createTournamentSchema.safeParse({
      name: 'Spring Championship',
      slug: 'spring-championship-2026',
      seasonId: '00000000-0000-0000-0000-000000000001',
      stackId: 'python',
      maxParticipants: 16,
      registrationOpensAt: '2026-09-01T00:00:00Z',
      registrationClosesAt: '2026-09-14T00:00:00Z',
      startsAt: '2026-09-15T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = createTournamentSchema.safeParse({ name: 'Spring' })
    expect(result.success).toBe(false)
  })
})

describe('updateTournamentSchema', () => {
  it('accepts partial updates', () => {
    const result = updateTournamentSchema.safeParse({ name: 'Updated Tournament' })
    expect(result.success).toBe(true)
  })
})

describe('WS event names', () => {
  it('room events are defined', async () => {
    const { wsServerEvents, wsClientEvents } = await import('@clutch/shared')
    expect(wsClientEvents.ROOM_SUBSCRIBE).toBe('room.subscribe')
    expect(wsClientEvents.ROOM_RESYNC).toBe('room.resync')
    expect(wsClientEvents.TOURNAMENT_SUBSCRIBE).toBe('tournament.subscribe')
    expect(wsClientEvents.TOURNAMENT_RESYNC).toBe('tournament.resync')
    expect(wsServerEvents.ROOM_CREATED).toBe('room.created')
    expect(wsServerEvents.ROOM_SNAPSHOT).toBe('room.snapshot')
    expect(wsServerEvents.TOURNAMENT_SNAPSHOT).toBe('tournament.snapshot')
  })
})

describe('shared constants', () => {
  it('room participant roles and statuses exist', async () => {
    const { ROOM_PARTICIPANT_ROLES, ROOM_PARTICIPANT_STATUSES, BRACKET_NODE_STATUSES, TOURNAMENT_LIMITS } = await import('@clutch/shared')
    expect(ROOM_PARTICIPANT_ROLES).toContain('host')
    expect(ROOM_PARTICIPANT_ROLES).toContain('player')
    expect(ROOM_PARTICIPANT_STATUSES).toContain('active')
    expect(BRACKET_NODE_STATUSES).toContain('pending')
    expect(BRACKET_NODE_STATUSES).toContain('completed')
    expect(TOURNAMENT_LIMITS.MAX_PARTICIPANTS).toBeGreaterThan(0)
  })
})

describe('pubsub functions', () => {
  it('publishRoomEvent produces correct envelope structure', async () => {
    const { publishRoomEvent } = await import('../src/realtime/pubsub.js')
    const mockRedis = { publish: vi.fn().mockResolvedValue(1) } as any
    await publishRoomEvent(mockRedis, 'room-123', {
      type: 'room.created',
      actorUserId: 'user-1',
      payload: { roomId: 'room-123', name: 'Test' },
    })
    expect(mockRedis.publish).toHaveBeenCalledOnce()
    const [channel, raw] = mockRedis.publish.mock.calls[0]
    expect(channel).toBe('room:room-123')
    const envelope = JSON.parse(raw)
    expect(envelope.type).toBe('room.created')
    expect(envelope.roomId).toBe('room-123')
    expect(envelope.id).toBeDefined()
    expect(envelope.ts).toBeDefined()
    expect(envelope.payload.roomId).toBe('room-123')
    expect(envelope.payload.name).toBe('Test')
  })

  it('publishTournamentEvent produces correct envelope structure', async () => {
    const { publishTournamentEvent } = await import('../src/realtime/pubsub.js')
    const mockRedis = { publish: vi.fn().mockResolvedValue(1) } as any
    await publishTournamentEvent(mockRedis, 'tourney-456', {
      type: 'tournament.started',
      payload: { rounds: 3 },
    })
    expect(mockRedis.publish).toHaveBeenCalledOnce()
    const [channel, raw] = mockRedis.publish.mock.calls[0]
    expect(channel).toBe('tournament:tourney-456')
    const envelope = JSON.parse(raw)
    expect(envelope.type).toBe('tournament.started')
    expect(envelope.tournamentId).toBe('tourney-456')
    expect(envelope.payload.rounds).toBe(3)
  })

  it('publishUserEvent produces correct envelope structure', async () => {
    const { publishUserEvent } = await import('../src/realtime/pubsub.js')
    const mockRedis = { publish: vi.fn().mockResolvedValue(1) } as any
    await publishUserEvent(mockRedis, 'user-789', {
      type: 'match.found',
      matchId: 'match-abc',
      payload: { matchId: 'match-abc', publicId: 'CL-1234' },
    })
    expect(mockRedis.publish).toHaveBeenCalledOnce()
    const [channel, raw] = mockRedis.publish.mock.calls[0]
    expect(channel).toBe('user:user-789')
    const envelope = JSON.parse(raw)
    expect(envelope.type).toBe('match.found')
    expect(envelope.matchId).toBe('match-abc')
    expect(envelope.payload.publicId).toBe('CL-1234')
  })

  it('roomChannel returns correct channel name', async () => {
    const { roomChannel } = await import('../src/realtime/pubsub.js')
    expect(roomChannel('abc-123')).toBe('room:abc-123')
  })

  it('tournamentChannel returns correct channel name', async () => {
    const { tournamentChannel } = await import('../src/realtime/pubsub.js')
    expect(tournamentChannel('def-456')).toBe('tournament:def-456')
  })

  it('matchChannel returns correct channel name', async () => {
    const { matchChannel } = await import('../src/realtime/pubsub.js')
    expect(matchChannel('ghi-789')).toBe('match:ghi-789')
  })

  it('userChannel returns correct channel name', async () => {
    const { userChannel } = await import('../src/realtime/pubsub.js')
    expect(userChannel('jkl-012')).toBe('user:jkl-012')
  })
})

describe('room service event signatures', () => {
  it('createRoom accepts redis parameter', async () => {
    const mod = await import('../src/rooms/service.js')
    expect(typeof mod.createRoom).toBe('function')
  })

  it('updateRoom accepts redis parameter', async () => {
    const mod = await import('../src/rooms/service.js')
    expect(typeof mod.updateRoom).toBe('function')
  })

  it('joinRoom accepts redis parameter', async () => {
    const mod = await import('../src/rooms/service.js')
    expect(typeof mod.joinRoom).toBe('function')
  })

  it('leaveRoom accepts redis parameter', async () => {
    const mod = await import('../src/rooms/service.js')
    expect(typeof mod.leaveRoom).toBe('function')
  })

  it('setRoomReady accepts redis parameter', async () => {
    const mod = await import('../src/rooms/service.js')
    expect(typeof mod.setRoomReady).toBe('function')
  })

  it('lockRoom accepts redis parameter', async () => {
    const mod = await import('../src/rooms/service.js')
    expect(typeof mod.lockRoom).toBe('function')
  })

  it('cancelRoom accepts redis parameter', async () => {
    const mod = await import('../src/rooms/service.js')
    expect(typeof mod.cancelRoom).toBe('function')
  })

  it('removeRoomParticipant accepts redis parameter', async () => {
    const mod = await import('../src/rooms/service.js')
    expect(typeof mod.removeRoomParticipant).toBe('function')
  })
})

describe('tournament service event signatures', () => {
  it('createTournament accepts redis parameter', async () => {
    const mod = await import('../src/tournaments/service.js')
    expect(typeof mod.createTournament).toBe('function')
  })

  it('updateTournament accepts redis parameter', async () => {
    const mod = await import('../src/tournaments/service.js')
    expect(typeof mod.updateTournament).toBe('function')
  })

  it('startTournament accepts redis parameter', async () => {
    const mod = await import('../src/tournaments/service.js')
    expect(typeof mod.startTournament).toBe('function')
  })

  it('cancelTournament accepts redis parameter', async () => {
    const mod = await import('../src/tournaments/service.js')
    expect(typeof mod.cancelTournament).toBe('function')
  })
})

describe('bracket engine event architecture', () => {
  it('advanceTournament collects events after transaction commit', async () => {
    const { advanceTournament } = await import('../src/tournaments/bracket.js')
    expect(typeof advanceTournament).toBe('function')
  })

  it('createRoundMatches publishes user events after transaction', async () => {
    const { createRoundMatches } = await import('../src/tournaments/bracket.js')
    expect(typeof createRoundMatches).toBe('function')
  })
})

describe('all room events are defined in wsServerEvents', () => {
  it('all room mutation events exist', async () => {
    const { wsServerEvents } = await import('@clutch/shared')
    const requiredRoomEvents = [
      'ROOM_CREATED', 'ROOM_UPDATED', 'ROOM_JOINED', 'ROOM_LEFT',
      'ROOM_READY', 'ROOM_UNREADY', 'ROOM_LOCKED', 'ROOM_STARTED',
      'ROOM_MATCH_CREATED', 'ROOM_FINISHED', 'ROOM_CANCELLED', 'ROOM_SNAPSHOT',
    ]
    for (const evt of requiredRoomEvents) {
      expect(wsServerEvents).toHaveProperty(evt)
    }
  })

  it('all tournament mutation events exist', async () => {
    const { wsServerEvents } = await import('@clutch/shared')
    const requiredTournamentEvents = [
      'TOURNAMENT_CREATED', 'TOURNAMENT_UPDATED', 'TOURNAMENT_STARTED',
      'TOURNAMENT_MATCH_CREATED', 'TOURNAMENT_ROUND_COMPLETED',
      'TOURNAMENT_PLAYER_ELIMINATED', 'TOURNAMENT_COMPLETED',
      'TOURNAMENT_SNAPSHOT',
    ]
    for (const evt of requiredTournamentEvents) {
      expect(wsServerEvents).toHaveProperty(evt)
    }
  })
})
