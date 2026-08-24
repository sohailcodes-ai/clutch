import { describe, expect, it } from 'vitest'
import { hasPermission, isAdminRole, ROLE_PERMISSIONS, ADMIN_PERMISSIONS } from '@clutch/shared'
import { redactSubmissionForAdmin } from '../src/admin/service.js'

describe('permission matrix (server-side authorization source of truth)', () => {
  it('regular users hold no permissions at all', () => {
    for (const p of ADMIN_PERMISSIONS) {
      expect(hasPermission('user', p)).toBe(false)
    }
  })

  it('recognizes administrative roles', () => {
    expect(isAdminRole('super_admin')).toBe(true)
    expect(isAdminRole('moderator')).toBe(true)
    expect(isAdminRole('user')).toBe(false)
    expect(isAdminRole('root')).toBe(false)
  })

  it('super_admin holds every permission including security', () => {
    for (const p of ADMIN_PERMISSIONS) {
      expect(hasPermission('super_admin', p)).toBe(true)
    }
  })

  it('plain admins do NOT automatically get security-sensitive access', () => {
    expect(hasPermission('admin', 'admin.security.view')).toBe(false)
    // ...but they do hold ordinary console permissions.
    expect(hasPermission('admin', 'admin.dashboard.view')).toBe(true)
    expect(hasPermission('admin', 'admin.matches.adjudicate')).toBe(true)
  })

  it('moderators can view/inspect but cannot adjudicate or moderate users', () => {
    expect(hasPermission('moderator', 'admin.matches.inspect')).toBe(true)
    expect(hasPermission('moderator', 'admin.users.view')).toBe(true)
    expect(hasPermission('moderator', 'admin.matches.adjudicate')).toBe(false)
    expect(hasPermission('moderator', 'admin.users.moderate')).toBe(false)
    expect(hasPermission('moderator', 'admin.questions.publish')).toBe(false)
  })

  it('scoped roles are properly limited', () => {
    expect(hasPermission('question_admin', 'admin.questions.create')).toBe(true)
    expect(hasPermission('question_admin', 'admin.questions.publish')).toBe(true)
    expect(hasPermission('question_admin', 'admin.matches.adjudicate')).toBe(false)

    expect(hasPermission('event_admin', 'admin.events.create')).toBe(true)
    expect(hasPermission('event_admin', 'admin.tournaments.manage')).toBe(false)

    expect(hasPermission('tournament_admin', 'admin.tournaments.manage')).toBe(true)
    expect(hasPermission('tournament_admin', 'admin.questions.create')).toBe(false)

    expect(hasPermission('match_moderator', 'admin.matches.adjudicate')).toBe(true)
    expect(hasPermission('match_moderator', 'admin.security.view')).toBe(false)
  })

  it('every role only references defined permissions', () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) {
        expect(ADMIN_PERMISSIONS).toContain(p)
      }
    }
  })
})

describe('admin submission redaction', () => {
  const raw = {
    id: 'sub-1',
    userId: 'user-1',
    status: 'accepted',
    passedCount: 4,
    totalCount: 4,
    executionTimeMs: 1234,
    isFinal: true,
    createdAt: new Date('2026-08-01T10:00:00Z'),
  }

  it('exposes evaluation state without ever returning source code', () => {
    const dto = redactSubmissionForAdmin(raw)
    expect(dto.status).toBe('accepted')
    expect(dto.passedCount).toBe(4)
    expect(dto.isFinal).toBe(true)
    expect(dto.createdAt).toBe('2026-08-01T10:00:00.000Z')
    expect(Object.keys(dto)).not.toContain('sourceCode')
    expect(Object.keys(dto)).not.toContain('language')
  })
})
