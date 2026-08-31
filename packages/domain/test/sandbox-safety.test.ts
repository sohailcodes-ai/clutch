import { describe, expect, it, afterEach } from 'vitest'
import { currentSandboxMode } from '../src/execution/index.js'

describe('sandbox safety', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('is exported and callable', () => {
    expect(typeof currentSandboxMode).toBe('function')
  })

  it('defaults to child_process in development', () => {
    process.env.NODE_ENV = 'development'
    process.env.SANDBOX_MODE = undefined
    expect(currentSandboxMode()).toBe('child_process')
  })

  it('uses docker when SANDBOX_MODE=docker', () => {
    process.env.NODE_ENV = 'development'
    process.env.SANDBOX_MODE = 'docker'
    expect(currentSandboxMode()).toBe('docker')
  })

  it('forces docker in production and rejects child_process', () => {
    process.env.NODE_ENV = 'production'
    process.env.SANDBOX_MODE = 'child_process'
    expect(() => currentSandboxMode()).toThrow('PRODUCTION SAFETY VIOLATION')
  })

  it('allows docker in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.SANDBOX_MODE = 'docker'
    expect(currentSandboxMode()).toBe('docker')
  })

  it('crashes when production has no SANDBOX_MODE set', () => {
    process.env.NODE_ENV = 'production'
    process.env.SANDBOX_MODE = undefined
    expect(() => currentSandboxMode()).toThrow('PRODUCTION SAFETY VIOLATION')
  })
})
