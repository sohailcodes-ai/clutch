/**
 * ============================================================================
 * DOCKER SANDBOX EXECUTION ENGINE
 * ============================================================================
 * Executes untrusted user code inside isolated Docker containers. This is the
 * production-grade alternative to the child_process-based executor.
 *
 * SECURITY CONTROLS:
 * - Network disabled (--network=none)
 * - Memory limit enforced (--memory)
 * - CPU limit enforced (--cpus)
 * - Process count limit (--pids-limit)
 * - No privileged mode
 * - All Linux capabilities dropped (--cap-drop=ALL)
 * - No new privileges (--security-opt=no-new-privileges)
 * - Read-only root filesystem (--read-only)
 * - Isolated writable /tmp inside container
 * - No access to host filesystem beyond mounted workspace
 * - No access to Docker socket
 * - No access to application environment variables
 * - Container cleaned up after every execution (success, failure, timeout)
 *
 * PRODUCTION NOTES:
 * - Requires Docker daemon running on the host
 * - Images must be built: `pnpm sandbox:build`
 * - Container startup adds ~100-200ms overhead vs child_process
 * - For even stronger isolation, consider Firecracker microVMs
 * ============================================================================
 */

import { execFile } from 'node:child_process'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { getRuntime, type LanguageRuntime } from './languages.js'
import type { SandboxResult } from './sandbox.js'

const execFileAsync = promisify(execFile)

const MAX_OUTPUT_BYTES = 1024 * 256 // 256 KB
const MAX_SOURCE_BYTES = 64 * 1024 // 64 KB

/** Docker security and resource configuration. */
const DOCKER_CONFIG = {
  /** Memory limit per container. */
  memory: '256m',
  /** CPU limit (fractional cores). */
  cpus: '1.0',
  /** Max processes inside container. */
  pidsLimit: 64,
  /** Stop timeout after SIGTERM (seconds). */
  stopTimeout: 5,
} as const

/**
 * Execute source code inside a Docker container.
 *
 * Lifecycle:
 * 1. Write source to temp directory
 * 2. Start container with temp dir mounted as /workspace
 * 3. For compiled languages: compile first, then execute
 * 4. Wait for completion or timeout
 * 5. Capture stdout/stderr/exit code
 * 6. Kill and remove container (always)
 * 7. Remove temp directory (always)
 */
export async function executeInDocker(params: {
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
  const filename = `solution${runtime.fileExtension}`
  const sourcePath = join(workDir, filename)
  const containerName = `clutch-exec-${randomBytes(8).toString('hex')}`
  const timeoutMs = params.timeLimitMs ?? runtime.timeoutMs
  const memoryLimit = params.memoryLimitMb
    ? `${params.memoryLimitMb}m`
    : DOCKER_CONFIG.memory

  try {
    await writeFile(sourcePath, params.sourceCode, 'utf8')
    const started = Date.now()

    // For compiled languages, run compile step inside the container first
    if (runtime.compiled && runtime.containerCompileCommand) {
      const outputFilename = 'solution'
      const compileArgs = runtime.containerCompileCommand(filename, outputFilename)

      const compileResult = await runDockerContainer({
        containerName,
        image: runtime.dockerImage,
        workDir,
        command: compileArgs,
        memoryLimit,
        timeoutMs,
        started,
      })

      if (compileResult.status !== 'accepted') {
        await forceRemoveContainer(containerName)
        return compileResult
      }

      // Compile succeeded — now run the compiled binary
      const runArgs = runtime.containerRunCommand(filename)
      const runResult = await runDockerContainer({
        containerName,
        image: runtime.dockerImage,
        workDir,
        command: runArgs,
        memoryLimit,
        timeoutMs,
        started,
      })
      await forceRemoveContainer(containerName)
      return runResult
    }

    // Interpreted language — run directly
    const containerCmd = runtime.containerRunCommand(filename)
    const result = await runDockerContainer({
      containerName,
      image: runtime.dockerImage,
      workDir,
      command: containerCmd,
      memoryLimit,
      timeoutMs,
      started,
    })
    await forceRemoveContainer(containerName)
    return result
  } finally {
    // Always clean up: container + temp directory
    await forceRemoveContainer(containerName)
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Run a single Docker container and return the execution result.
 * Handles timeout, OOM, output limits, and error classification.
 */
async function runDockerContainer(params: {
  containerName: string
  image: string
  workDir: string
  command: string[]
  memoryLimit: string
  timeoutMs: number
  started: number
}): Promise<SandboxResult> {
  const { containerName, image, workDir, command, memoryLimit, timeoutMs, started } = params

  const dockerArgs = [
    'run',
    '--rm',
    '--name', containerName,
    // Security
    '--network=none',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--read-only',
    // Resource limits
    '--memory', memoryLimit,
    '--memory-swap', memoryLimit,
    '--cpus', DOCKER_CONFIG.cpus,
    '--pids-limit', String(DOCKER_CONFIG.pidsLimit),
    // Writable tmp for compiled artifacts and interpreters
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
    // Mount source into container
    '-v', `${workDir}:/workspace:ro`,
    // Working directory
    '-w', '/workspace',
    // Image
    image,
    // Command
    ...command,
  ]

  try {
    const result = await execFileAsync('docker', dockerArgs, {
      timeout: timeoutMs + 2000, // extra 2s for container startup/shutdown
      maxBuffer: MAX_OUTPUT_BYTES,
      windowsHide: true,
      env: {}, // No environment variables passed to container
    })

    const elapsed = Date.now() - started
    return {
      stdout: truncate(result.stdout),
      stderr: truncate(result.stderr),
      exitCode: 0,
      timedOut: false,
      memoryExceeded: false,
      executionTimeMs: elapsed,
      status: 'accepted',
    }
  } catch (err: unknown) {
    const elapsed = Date.now() - started

    if (isExecError(err)) {
      // Timeout: kill the container
      if (err.killed || err.signal === 'SIGTERM') {
        await forceRemoveContainer(containerName)
        return {
          stdout: '',
          stderr: '',
          exitCode: 1,
          timedOut: true,
          memoryExceeded: false,
          executionTimeMs: elapsed,
          status: 'time_limit',
        }
      }

      // Output overflow
      if (err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        await forceRemoveContainer(containerName)
        return {
          stdout: truncate(err.stdout ?? ''),
          stderr: '',
          exitCode: 1,
          timedOut: false,
          memoryExceeded: false,
          executionTimeMs: elapsed,
          status: 'internal_error',
        }
      }

      const stderr = err.stderr ?? ''
      const stdout = err.stdout ?? ''
      const exitCode = typeof err.code === 'number' ? err.code : 1

      await forceRemoveContainer(containerName)

      // Check for OOM kill (Docker reports exit code 137)
      if (exitCode === 137 || stderr.includes('OOMKilled') || stderr.includes('Memory limit')) {
        return {
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          exitCode,
          timedOut: false,
          memoryExceeded: true,
          executionTimeMs: elapsed,
          status: 'memory_limit',
        }
      }

      // Non-zero exit from compile step = compile error
      // Non-zero exit from run step = runtime error
      // We distinguish by checking if compile output contains error patterns
      if (stderr.length > 0 && isCompileError(stderr)) {
        return {
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          exitCode,
          timedOut: false,
          memoryExceeded: false,
          executionTimeMs: elapsed,
          status: 'compile_error',
        }
      }

      return {
        stdout: truncate(stdout),
        stderr: truncate(stderr),
        exitCode,
        timedOut: false,
        memoryExceeded: false,
        executionTimeMs: elapsed,
        status: 'runtime_error',
      }
    }

    await forceRemoveContainer(containerName)
    return fail('internal_error', err instanceof Error ? err.message : 'Unknown Docker error')
  }
}

/** Force-remove a container, ignoring errors if it's already gone. */
async function forceRemoveContainer(name: string): Promise<void> {
  try {
    await execFileAsync('docker', ['rm', '-f', name], {
      timeout: 5000,
      windowsHide: true,
      env: {},
    })
  } catch {
    // Container may already be removed by --rm, or never started
  }
}

function truncate(output: string): string {
  const bytes = Buffer.from(output, 'utf8')
  if (bytes.length <= MAX_OUTPUT_BYTES) return output
  return bytes.subarray(0, MAX_OUTPUT_BYTES).toString('utf8')
}

async function createWorkDir(): Promise<string> {
  const id = randomBytes(8).toString('hex')
  const dir = join(tmpdir(), `clutch-docker-${id}`)
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

type ExecError = Error & {
  code?: number | string
  stdout?: string
  stderr?: string
  killed?: boolean
  signal?: string
}

function isExecError(err: unknown): err is ExecError {
  return typeof err === 'object' && err !== null && ('stdout' in err || 'stderr' in err)
}

function isCompileError(stderr: string): boolean {
  const lower = stderr.toLowerCase()
  return (
    // C/C++ compilation errors
    lower.includes('error:') ||
    lower.includes('fatal error:') ||
    lower.includes('no such file or directory') ||
    // Java compilation errors
    lower.includes('cannot find symbol') ||
    lower.includes('error: java') ||
    lower.includes('.java:') ||
    // Go compilation errors
    lower.includes('cannot use') ||
    lower.includes('undefined:') ||
    lower.includes('imported and not used') ||
    // Rust compilation errors
    lower.includes('error[E') ||
    lower.includes('aborting due to') ||
    lower.includes('could not compile')
  )
}
