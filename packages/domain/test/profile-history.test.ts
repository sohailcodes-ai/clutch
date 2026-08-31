import { describe, expect, it } from 'vitest'
import {
  getMatchHistory,
  getRatingHistory,
  getPlayerStats,
} from '../src/profile/history.js'

describe('match history', () => {
  it('getMatchHistory is exported and callable', () => {
    expect(typeof getMatchHistory).toBe('function')
  })

  it('getRatingHistory is exported and callable', () => {
    expect(typeof getRatingHistory).toBe('function')
  })

  it('getPlayerStats is exported and callable', () => {
    expect(typeof getPlayerStats).toBe('function')
  })
})
