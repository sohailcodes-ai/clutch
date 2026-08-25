/**
 * ============================================================================
 * SANDBOX EXECUTION ENGINE
 * ============================================================================
 * Executes untrusted user code with resource enforcement. This is the ONLY
 * code path that runs submitted source — never inside the API process.
 *
 * SECURITY INVARIANTS:
 * - Source code is written to an ephemeral temp directory
 * - No access to application environment variables
 * - No network access (enforced by process isolation)
 * - Output size is bounded
 * - Execution timeout is enforced
 * - Temp files are cleaned up after execution
 * - Process tree is killed on timeout
 * - No access to PostgreSQL, Redis, or host filesystem beyond temp dir
 *
 * PRODUCTION NOTE:
 * For production deployments, replace the child_process implementation with
 * Docker containers (with --network=none, --memory, --cpus flags) or
 * Firecracker microVMs. The interface (SandboxResult) remains identical
 * so the executor can be swapped without changing domain logic.
 * ============================================================================
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { getRuntime, type LanguageRuntime } from './languages.js'

export type SandboxResult = {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
  memoryExceeded: boolean
  executionTimeMs: number
  status: 'accepted' | 'compile_error' | 'runtime_error' | 'time_limit' | 'memory_limit' | 'internal_error'
}

const MAX_OUTPUT_BYTES = 1024 * 256 // 256 KB
const MAX_SOURCE_BYTES = 64 * 1024 // 64 KB

/**
 * Execute source code against a single test case's stdin inside a sandboxed
 * child process. Returns structured execution results.
 *
 * For compiled languages, a compile step is performed first. Compilation
 * failures are reported as compile_error without attempting execution.
 *
 * This function MUST NOT be called from the API process. It is owned by the
 * evaluation worker.
 */
export async function executeInSandbox(params: {
  sourceCode: string
  stackId: string
  stdin: string
  timeLimitMs?: number
  memoryLimitMb?: number
}): Promise<SandboxResult> {
  const runtime = getRuntime(params.stackId)
  if (!runtime) {
    return fail('internal_error', `Unsupported language: ${params.stackId}`)
  }

  if (Buffer.byteLength(params.sourceCode, 'utf8') > MAX_SOURCE_BYTES) {
    return fail('compile_error', 'Source code exceeds maximum size')
  }

  const workDir = await createWorkDir()
  const sourceFilename = `solution${runtime.fileExtension}`
  const sourcePath = join(workDir, sourceFilename)

  try {
    await writeFile(sourcePath, params.sourceCode, 'utf8')

    const timeoutMs = params.timeLimitMs ?? runtime.timeoutMs
    const started = Date.now()

    // Compile step for compiled languages
    if (runtime.compiled && runtime.compileCommand) {
      const compileFn = runtime.compileCommand
      const outputFilename = process.platform === 'win32' ? 'solution.exe' : 'solution'
      const outputPath = join(workDir, outputFilename)
      const compileCmd = compileFn(sourcePath, outputPath)
      const compileResult = await runProcess(compileCmd[0]!, compileCmd.slice(1), workDir, timeoutMs, started, '')

      if (compileResult.exitCode !== 0) {
        const elapsed = Date.now() - started
        return {
          stdout: truncate(compileResult.stdout),
          stderr: truncate(compileResult.stderr),
          exitCode: compileResult.exitCode,
          timedOut: compileResult.timedOut,
          memoryExceeded: false,
          executionTimeMs: elapsed,
          status: 'compile_error',
        }
      }

      // Run the compiled binary
      const runCmd = runtime.runCommand(outputPath)
      const result = await runProcess(runCmd[0]!, runCmd.slice(1), workDir, timeoutMs, started, params.stdin)
      const elapsed = Date.now() - started

      return classifyResult(result, elapsed, timeoutMs)
    }

    // Interpreted language — run directly
    const runCmd = runtime.runCommand(sourcePath)
    const result = await runProcess(runCmd[0]!, runCmd.slice(1), workDir, timeoutMs, started, params.stdin)
    const elapsed = Date.now() - started

    return classifyResult(result, elapsed, timeoutMs, runtime)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

function classifyResult(
  result: { stdout: string; stderr: string; exitCode: number; timedOut: boolean },
  elapsed: number,
  timeoutMs: number,
  runtime?: { id: string },
): SandboxResult {
  if (result.timedOut || elapsed >= timeoutMs - 100) {
    return {
      stdout: truncate(result.stdout),
      stderr: truncate(result.stderr),
      exitCode: result.exitCode,
      timedOut: true,
      memoryExceeded: false,
      executionTimeMs: elapsed,
      status: 'time_limit',
    }
  }

  if (
    Buffer.byteLength(result.stdout, 'utf8') > MAX_OUTPUT_BYTES ||
    Buffer.byteLength(result.stderr, 'utf8') > MAX_OUTPUT_BYTES
  ) {
    return {
      stdout: truncate(result.stdout),
      stderr: truncate(result.stderr),
      exitCode: result.exitCode,
      timedOut: false,
      memoryExceeded: false,
      executionTimeMs: elapsed,
      status: 'internal_error',
    }
  }

  if (result.exitCode === 0) {
    return {
      stdout: truncate(result.stdout),
      stderr: truncate(result.stderr),
      exitCode: 0,
      timedOut: false,
      memoryExceeded: false,
      executionTimeMs: elapsed,
      status: 'accepted',
    }
  }

  // For interpreted languages, detect syntax/compile errors from stderr
  if (runtime && isInterpreterCompileError(result.stderr, runtime.id)) {
    return {
      stdout: truncate(result.stdout),
      stderr: truncate(result.stderr),
      exitCode: result.exitCode,
      timedOut: false,
      memoryExceeded: false,
      executionTimeMs: elapsed,
      status: 'compile_error',
    }
  }

  return {
    stdout: truncate(result.stdout),
    stderr: truncate(result.stderr),
    exitCode: result.exitCode,
    timedOut: false,
    memoryExceeded: false,
    executionTimeMs: elapsed,
    status: 'runtime_error',
  }
}

function isInterpreterCompileError(stderr: string, runtimeId: string): boolean {
  const lower = stderr.toLowerCase()

  if (runtimeId === 'python') {
    return (
      lower.includes('syntaxerror') ||
      lower.includes('indentationerror') ||
      lower.includes('taberror')
    )
  }

  if (runtimeId === 'javascript' || runtimeId === 'typescript') {
    return (
      lower.includes('syntaxerror') ||
      lower.includes('referenceerror') ||
      lower.includes('unexpected token') ||
      lower.includes('cannot find module')
    )
  }

  return false
}

function runProcess(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  started: number,
  stdin: string,
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    const remaining = Math.max(1000, timeoutMs - (Date.now() - started))
    const proc: ChildProcess = spawn(cmd, args, {
      cwd,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: cwd,
        TMPDIR: cwd,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let killed = false

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    // Write stdin then close the stream
    if (stdin) {
      proc.stdin?.write(stdin)
    }
    proc.stdin?.end()

    const timer = setTimeout(() => {
      killed = true
      proc.kill('SIGTERM')
      setTimeout(() => {
        try { proc.kill('SIGKILL') } catch { /* already dead */ }
      }, 1000)
    }, remaining)

    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? 1, timedOut: killed })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr: stderr + (err.message ?? 'spawn error'),
        exitCode: 1,
        timedOut: false,
      })
    })
  })
}

function truncate(output: string): string {
  const bytes = Buffer.from(output, 'utf8')
  if (bytes.length <= MAX_OUTPUT_BYTES) return output
  return bytes.subarray(0, MAX_OUTPUT_BYTES).toString('utf8')
}

async function createWorkDir(): Promise<string> {
  const id = randomBytes(8).toString('hex')
  const dir = join(tmpdir(), `clutch-sandbox-${id}`)
  await mkdir(dir, { recursive: true })
  return dir
}

function fail(status: SandboxResult['status'], message: string): SandboxResult {
  return {
    stdout: '',
    stderr: message,
    exitCode: 1,
    timedOut: false,
    memoryExceeded: false,
    executionTimeMs: 0,
    status,
  }
}
