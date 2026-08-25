/**
 * ============================================================================
 * SANDBOX EXECUTOR FACTORY
 * ============================================================================
 * Selects the appropriate code execution backend based on the SANDBOX_MODE
 * environment variable:
 *
 *   child_process  — direct OS process execution (development, no Docker needed)
 *   docker         — isolated Docker container execution (production)
 *
 * The factory ensures the rest of the domain layer remains completely unaware
 * of which executor is in use. Both implementations return the same
 * `SandboxResult` type.
 * ============================================================================
 */

import type { SandboxResult } from './sandbox.js'
import { executeInSandbox } from './sandbox.js'
import { executeInDocker } from './docker-sandbox.js'

export type { SandboxResult } from './sandbox.js'

export type SandboxMode = 'child_process' | 'docker'

function getSandboxMode(): SandboxMode {
  const mode = (process.env.SANDBOX_MODE ?? 'child_process').toLowerCase()
  if (mode === 'docker') return 'docker'
  return 'child_process'
}

/**
 * Execute source code in the configured sandbox environment.
 *
 * This is the single entry point for all code execution in Clutch.
 * The caller (evaluation/runner.ts) never needs to know which backend is used.
 */
export async function execute(params: {
  sourceCode: string
  stackId: string
  stdin: string
  timeLimitMs?: number
  memoryLimitMb?: number
}): Promise<SandboxResult> {
  const mode = getSandboxMode()

  if (mode === 'docker') {
    return executeInDocker(params)
  }

  return executeInSandbox(params)
}

/** Returns the currently configured sandbox mode (for logging/diagnostics). */
export function currentSandboxMode(): SandboxMode {
  return getSandboxMode()
}
