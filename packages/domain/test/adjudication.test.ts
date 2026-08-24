import { describe, expect, it } from 'vitest'
import { validateAdjudication } from '../src/match/resolution.js'
import { deriveAdminEmail } from '../src/admin/bootstrap.js'

const participants = [{ userId: '11111111-1111-1111-1111-111111111111' }, { userId: '22222222-2222-2222-2222-222222222222' }]
const winner = participants[0]!.userId
const reason = 'Evaluation infrastructure failed for player B; manual review confirms player A.'

describe('adjudication validation (pure, deterministic)', () => {
  it('accepts a valid override of a live match', () => {
    for (const status of ['matched', 'starting', 'active', 'evaluating', 'abandoned']) {
      expect(validateAdjudication({ status, participants }, { matchId: 'm', winnerUserId: winner, reason }).ok).toBe(true)
    }
  })

  it('requires a substantive reason', () => {
    expect(validateAdjudication({ status: 'active', participants }, { matchId: 'm', winnerUserId: winner, reason: '' }).ok).toBe(false)
    expect(validateAdjudication({ status: 'active', participants }, { matchId: 'm', winnerUserId: winner, reason: 'short' }).ok).toBe(false)
    expect(
      validateAdjudication({ status: 'active', participants }, { matchId: 'm', winnerUserId: winner, reason: 'x'.repeat(1001) })
        .ok,
    ).toBe(false)
  })

  it('rejects winners who are not participants of the match', () => {
    const result = validateAdjudication(
      { status: 'active', participants },
      { matchId: 'm', winnerUserId: '99999999-9999-9999-9999-999999999999', reason },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('VALIDATION')
  })

  it('refuses terminal states — duplicate adjudication and post-resolution overrides are impossible', () => {
    for (const status of ['resolved', 'draw', 'cancelled']) {
      const result = validateAdjudication({ status, participants }, { matchId: 'm', winnerUserId: winner, reason })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('CONFLICT')
    }
  })

  it('is deterministic', () => {
    const input = { matchId: 'm', winnerUserId: winner, reason }
    expect(validateAdjudication({ status: 'active', participants }, input)).toEqual(
      validateAdjudication({ status: 'active', participants }, input),
    )
  })
})

describe('admin bootstrap identity helpers', () => {
  it('derives a stable internal email from the handle (no credential material involved)', () => {
    expect(deriveAdminEmail('sami')).toBe('sami@admins.clutch.local')
    expect(deriveAdminEmail('Sami')).toBe(deriveAdminEmail('sami'))
  })
})
