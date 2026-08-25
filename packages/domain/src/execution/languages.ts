/**
 * ============================================================================
 * LANGUAGE RUNTIME REGISTRY
 * ============================================================================
 * Maps stack IDs to their compilation/execution commands. The registry is the
 * single source of truth for which languages are actually available in this
 * deployment. The frontend must derive supported languages from this data
 * rather than hardcoding unsupported languages.
 *
 * SECURITY: Never expose internal paths, compiler versions, or system details
 * to clients. This registry is server-side only.
 *
 * DOCKER IMAGES:
 * Each runtime has a corresponding Docker image tag. Images are built from
 * infra/sandbox/Dockerfile.<runtime>. The containerRunCommand is the command
 * executed INSIDE the container with the source file mounted at /workspace/.
 * ============================================================================
 */

export type LanguageRuntime = {
  id: string
  name: string
  fileExtension: string
  compiled: boolean
  /** Compile command on the HOST (child_process mode). Output goes to outputPath. */
  compileCommand?: (sourcePath: string, outputPath: string) => string[]
  /** Command executed on the HOST to run the source file or compiled binary (child_process mode). */
  runCommand: (path: string) => string[]
  /** Docker image tag for container-based execution. */
  dockerImage: string
  /**
   * Compile command INSIDE the container. Source is at /workspace/solution<ext>.
   * Output is written to /tmp (writable inside container). Only called for compiled languages.
   */
  containerCompileCommand?: (sourceFilename: string, outputFilename: string) => string[]
  /** Command executed INSIDE the container. The source file is at /workspace/solution<ext>. */
  containerRunCommand: (filename: string) => string[]
  timeoutMs: number
  memoryLimitMb: number
}

const RUNTIMES: Record<string, LanguageRuntime> = {
  python: {
    id: 'python',
    name: 'Python',
    fileExtension: '.py',
    compiled: false,
    runCommand: (path) => ['python', '-u', path],
    dockerImage: 'clutch-python:latest',
    containerRunCommand: (filename) => ['python', '-u', `/workspace/${filename}`],
    timeoutMs: 10_000,
    memoryLimitMb: 256,
  },
  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    fileExtension: '.js',
    compiled: false,
    runCommand: (path) => ['node', path],
    dockerImage: 'clutch-node:latest',
    containerRunCommand: (filename) => ['node', `/workspace/${filename}`],
    timeoutMs: 10_000,
    memoryLimitMb: 256,
  },
  typescript: {
    id: 'typescript',
    name: 'TypeScript',
    fileExtension: '.ts',
    compiled: false,
    runCommand: (path) => ['node', '--experimental-strip-types', '--no-warnings', path],
    dockerImage: 'clutch-node:latest',
    containerRunCommand: (filename) => [
      'node',
      '--experimental-strip-types',
      '--no-warnings',
      `/workspace/${filename}`,
    ],
    timeoutMs: 10_000,
    memoryLimitMb: 256,
  },
  cpp: {
    id: 'cpp',
    name: 'C++',
    fileExtension: '.cpp',
    compiled: true,
    compileCommand: (src, out) => ['g++', '-O2', '-std=c++17', '-o', out, src],
    runCommand: (path) => [path],
    dockerImage: 'clutch-cpp:latest',
    containerCompileCommand: (src, out) => [
      'g++', '-O2', '-std=c++17', '-o', `/tmp/${out}`, `/workspace/${src}`,
    ],
    containerRunCommand: () => ['/tmp/solution'],
    timeoutMs: 10_000,
    memoryLimitMb: 256,
  },
  java: {
    id: 'java',
    name: 'Java',
    fileExtension: '.java',
    compiled: true,
    compileCommand: (src, _out) => ['javac', '-d', '.', src],
    runCommand: (path) => ['java', '-cp', '.', 'Solution'],
    dockerImage: 'clutch-java:latest',
    containerCompileCommand: (src, _out) => [
      'javac', '-d', '/tmp', `/workspace/${src}`,
    ],
    containerRunCommand: () => ['java', '-cp', '/tmp', 'Solution'],
    timeoutMs: 15_000,
    memoryLimitMb: 256,
  },
  go: {
    id: 'go',
    name: 'Go',
    fileExtension: '.go',
    compiled: true,
    compileCommand: (src, out) => ['go', 'build', '-o', out, src],
    runCommand: (path) => [path],
    dockerImage: 'clutch-go:latest',
    containerCompileCommand: (src, out) => [
      'go', 'build', '-o', `/tmp/${out}`, `/workspace/${src}`,
    ],
    containerRunCommand: () => ['/tmp/solution'],
    timeoutMs: 10_000,
    memoryLimitMb: 256,
  },
  rust: {
    id: 'rust',
    name: 'Rust',
    fileExtension: '.rs',
    compiled: true,
    compileCommand: (src, out) => ['rustc', '-O', '-o', out, src],
    runCommand: (path) => [path],
    dockerImage: 'clutch-rust:latest',
    containerCompileCommand: (src, out) => [
      'rustc', '-O', '-o', `/tmp/${out}`, `/workspace/${src}`,
    ],
    containerRunCommand: () => ['/tmp/solution'],
    timeoutMs: 15_000,
    memoryLimitMb: 256,
  },
}

export function getRuntime(stackId: string): LanguageRuntime | null {
  return RUNTIMES[stackId] ?? null
}

export function getAvailableStackIds(): string[] {
  return Object.keys(RUNTIMES)
}

export function isLanguageAvailable(stackId: string): boolean {
  return stackId in RUNTIMES
}
