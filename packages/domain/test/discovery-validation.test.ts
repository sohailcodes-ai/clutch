import { describe, expect, it } from 'vitest'
import { validateRoomConfig } from '@clutch/shared'
import { eventPhase, canRegisterForEvent } from '@clutch/shared'
import { canRegisterForTournament } from '@clutch/shared'

describe('room configuration validation', () => {
  const base = {
    name: 'Python Arena',
    stackId: 'python',
    difficultyId: null,
    maxPlayers: 8,
    isPublic: true,
    ranked: false,
    timeLimitSec: 900,
    questionSelectionMode: 'adaptive' as const,
  }

  it('accepts a valid public unranked room', () => {
    expect(validateRoomConfig(base)).toEqual({ ok: true })
  })

  it('rejects impossible capacities and timings', () => {
    expect(validateRoomConfig({ ...base, maxPlayers: 1 }).ok).toBe(false)
    expect(validateRoomConfig({ ...base, maxPlayers: 999 }).ok).toBe(false)
    expect(validateRoomConfig({ ...base, timeLimitSec: 5 }).ok).toBe(false)
    expect(validateRoomConfig({ ...base, timeLimitSec: 100000 }).ok).toBe(false)
  })
})

describe('event phases are server-time authoritative', () => {
  const now = new Date('2026-08-01T12:00:00Z')
  const event = {
    startsAt: new Date('2026-08-01T10:00:00Z'),
    endsAt: new Date('2026-08-03T10:00:00Z'),
  }

  it('derives upcoming/active/ended strictly from the server clock', () => {
    expect(eventPhase(now, event)).toBe('active')
    expect(eventPhase(new Date('2026-08-01T09:00:00Z'), event)).toBe('upcoming')
    expect(eventPhase(new Date('2026-08-03T11:00:00Z'), event)).toBe('ended')
  })

  it('registration follows the same window rules', () => {
    expect(canRegisterForEvent(now, event)).toEqual({ ok: true })
    const ended = canRegisterForEvent(new Date('2026-08-04T00:00:00Z'), event)
    expect(ended.ok).toBe(false)
  })
})

describe('tournament registration eligibility', () => {
  const now = new Date('2026-08-01T12:00:00Z')
  const tournament = {
    status: 'registration_open',
    registrationOpensAt: new Date('2026-08-01T00:00:00Z'),
    registrationClosesAt: new Date('2026-08-05T00:00:00Z'),
    startsAt: new Date('2026-08-06T00:00:00Z'),
    maxParticipants: 128,
    registeredCount: 127,
  }

  it('allows eligible players inside the window with capacity left', () => {
    expect(canRegisterForTournament(now, tournament)).toEqual({ ok: true })
  })

  it('enforces participant limits deterministically', () => {
    const result = canRegisterForTournament(now, { ...tournament, registeredCount: 128 })
    expect(result.ok).toBe(false)
  })

  it('rejects closed or future windows and wrong statuses', () => {
    expect(
      canRegisterForTournament(now, { ...tournament, status: 'running' }).ok,
    ).toBe(false)
    expect(
      canRegisterForTournament(new Date('2026-07-30T00:00:00Z'), tournament).ok,
    ).toBe(false)
    expect(
      canRegisterForTournament(new Date('2026-08-09T00:00:00Z'), tournament).ok,
    ).toBe(false)
  })
})
