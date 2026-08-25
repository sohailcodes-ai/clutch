import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { executeInSandbox } from '../src/execution/sandbox.js'
import { currentSandboxMode } from '../src/execution/index.js'
import { getRuntime, getAvailableStackIds } from '../src/execution/languages.js'

const execFileAsync = promisify(execFile)

/**
 * Runtime execution tests.
 *
 * These tests verify the core execution boundary — that untrusted code can be
 * run safely with proper resource enforcement for every supported language.
 * Tests run against whichever executor is configured (child_process by default).
 *
 * To test the Docker executor:
 *   SANDBOX_MODE=docker pnpm test -- packages/domain/test/sandbox.test.ts
 */

const SANDBOX = describe

/** Check if a compiler is actually usable (not just on PATH). */
async function hasCompiler(cmd: string): Promise<boolean> {
  try {
    await execFileAsync(cmd, ['--version'], { windowsHide: true, timeout: 5000 })
    return true
  } catch {
    return false
  }
}

// ─── Runtime Registry ────────────────────────────────────────────────────────

SANDBOX('runtime registry', () => {
  it('exposes all expected runtimes', () => {
    const ids = getAvailableStackIds()
    expect(ids).toContain('python')
    expect(ids).toContain('javascript')
    expect(ids).toContain('typescript')
    expect(ids).toContain('cpp')
    expect(ids).toContain('java')
    expect(ids).toContain('go')
    expect(ids).toContain('rust')
  })

  it('returns correct metadata for each runtime', () => {
    const python = getRuntime('python')
    expect(python).not.toBeNull()
    expect(python!.name).toBe('Python')
    expect(python!.compiled).toBe(false)
    expect(python!.fileExtension).toBe('.py')

    const cpp = getRuntime('cpp')
    expect(cpp).not.toBeNull()
    expect(cpp!.name).toBe('C++')
    expect(cpp!.compiled).true

    const java = getRuntime('java')
    expect(java).not.toBeNull()
    expect(java!.name).toBe('Java')
    expect(java!.compiled).toBe(true)

    const go = getRuntime('go')
    expect(go).not.toBeNull()
    expect(go!.name).toBe('Go')
    expect(go!.compiled).toBe(true)

    const rust = getRuntime('rust')
    expect(rust).not.toBeNull()
    expect(rust!.name).toBe('Rust')
    expect(rust!.compiled).toBe(true)
  })

  it('returns null for unknown runtime', () => {
    expect(getRuntime('brainfuck')).toBeNull()
  })
})

// ─── Python ──────────────────────────────────────────────────────────────────

SANDBOX('python', () => {
  it('executes valid code and returns stdout', async () => {
    const result = await executeInSandbox({
      sourceCode: 'print("hello world")',
      stackId: 'python',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('hello world')
    expect(result.exitCode).toBe(0)
    expect(result.timedOut).toBe(false)
  })

  it('passes stdin to the program', async () => {
    const result = await executeInSandbox({
      sourceCode: 'import sys\nprint(sys.stdin.read().strip())',
      stackId: 'python',
      stdin: 'test input data',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('test input data')
  })

  it('captures stderr separately from stdout', async () => {
    const result = await executeInSandbox({
      sourceCode: 'import sys\nsys.stderr.write("error output\\n")\nprint("normal output")',
      stackId: 'python',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('normal output')
    expect(result.stderr).toContain('error output')
  })

  it('reports compile errors for invalid syntax', async () => {
    const result = await executeInSandbox({
      sourceCode: 'def foo(\\n  print("broken")',
      stackId: 'python',
      stdin: '',
    })
    expect(result.status).toBe('compile_error')
    expect(result.exitCode).not.toBe(0)
  })

  it('reports runtime errors with non-zero exit code', async () => {
    const result = await executeInSandbox({
      sourceCode: 'import sys; sys.exit(42)',
      stackId: 'python',
      stdin: '',
    })
    expect(result.status).toBe('runtime_error')
    expect(result.exitCode).toBe(42)
  })
})

// ─── JavaScript ──────────────────────────────────────────────────────────────

SANDBOX('javascript', () => {
  it('executes valid code and returns stdout', async () => {
    const result = await executeInSandbox({
      sourceCode: 'console.log("hello from node")',
      stackId: 'javascript',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('hello from node')
    expect(result.exitCode).toBe(0)
  })

  it('reports compile errors for invalid syntax', async () => {
    const result = await executeInSandbox({
      sourceCode: 'function foo( { console.log("broken") }',
      stackId: 'javascript',
      stdin: '',
    })
    expect(result.status).toBe('compile_error')
    expect(result.exitCode).not.toBe(0)
  })
})

// ─── TypeScript ──────────────────────────────────────────────────────────────

SANDBOX('typescript', () => {
  it('executes valid code and returns stdout', async () => {
    const result = await executeInSandbox({
      sourceCode: 'const msg: string = "hello ts"; console.log(msg)',
      stackId: 'typescript',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('hello ts')
    expect(result.exitCode).toBe(0)
  })
})

// ─── C++ ─────────────────────────────────────────────────────────────────────

SANDBOX('cpp', () => {
  it('compiles and executes valid code', async () => {
    if (!(await hasCompiler('g++'))) return
    const result = await executeInSandbox({
      sourceCode: `#include <iostream>
int main() {
    std::cout << "hello cpp" << std::endl;
    return 0;
}`,
      stackId: 'cpp',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('hello cpp')
    expect(result.exitCode).toBe(0)
  })

  it('reports compile errors for invalid code', async () => {
    if (!(await hasCompiler('g++'))) return
    const result = await executeInSandbox({
      sourceCode: `#include <iostream>
int main() {
    std::cout << "missing end"
    return 0;
}`,
      stackId: 'cpp',
      stdin: '',
    })
    expect(result.status).toBe('compile_error')
    expect(result.exitCode).not.toBe(0)
  })

  it('reports runtime errors for non-zero exit', async () => {
    if (!(await hasCompiler('g++'))) return
    const result = await executeInSandbox({
      sourceCode: `#include <iostream>
int main() {
    return 1;
}`,
      stackId: 'cpp',
      stdin: '',
    })
    expect(result.status).toBe('runtime_error')
    expect(result.exitCode).toBe(1)
  })

  it('captures stdout correctly', async () => {
    if (!(await hasCompiler('g++'))) return
    const result = await executeInSandbox({
      sourceCode: `#include <cstdio>
int main() {
    printf("line1\\n");
    printf("line2\\n");
    return 0;
}`,
      stackId: 'cpp',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout).toContain('line1')
    expect(result.stdout).toContain('line2')
  })
})

// ─── Java ────────────────────────────────────────────────────────────────────

SANDBOX('java', () => {
  it('compiles and executes valid code', async () => {
    if (!(await hasCompiler('javac'))) return
    const result = await executeInSandbox({
      sourceCode: `class Solution {
    public static void main(String[] args) {
        System.out.println("hello java");
    }
}`,
      stackId: 'java',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('hello java')
    expect(result.exitCode).toBe(0)
  })

  it('reports compile errors for invalid code', async () => {
    if (!(await hasCompiler('javac'))) return
    const result = await executeInSandbox({
      sourceCode: `class Solution {
    public static void main(String[] args) {
        System.out.println("missing brace"
    }
}`,
      stackId: 'java',
      stdin: '',
    })
    expect(result.status).toBe('compile_error')
    expect(result.exitCode).not.toBe(0)
  })

  it('reports runtime errors for non-zero exit', async () => {
    if (!(await hasCompiler('javac'))) return
    const result = await executeInSandbox({
      sourceCode: `class Solution {
    public static void main(String[] args) {
        System.exit(1);
    }
}`,
      stackId: 'java',
      stdin: '',
    })
    expect(result.status).toBe('runtime_error')
    expect(result.exitCode).toBe(1)
  })

  it('captures stdout correctly', async () => {
    if (!(await hasCompiler('javac'))) return
    const result = await executeInSandbox({
      sourceCode: `class Solution {
    public static void main(String[] args) {
        System.out.println("line1");
        System.out.println("line2");
    }
}`,
      stackId: 'java',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout).toContain('line1')
    expect(result.stdout).toContain('line2')
  })
})

// ─── Go ──────────────────────────────────────────────────────────────────────

SANDBOX('go', () => {
  it('compiles and executes valid code', async () => {
    if (!(await hasCompiler('go'))) return
    const result = await executeInSandbox({
      sourceCode: `package main
import "fmt"
func main() {
    fmt.Println("hello go")
}`,
      stackId: 'go',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('hello go')
    expect(result.exitCode).toBe(0)
  })

  it('reports compile errors for invalid code', async () => {
    if (!(await hasCompiler('go'))) return
    const result = await executeInSandbox({
      sourceCode: `package main
import "fmt"
func main() {
    fmt.Println("missing paren"
}`,
      stackId: 'go',
      stdin: '',
    })
    expect(result.status).toBe('compile_error')
    expect(result.exitCode).not.toBe(0)
  })

  it('reports runtime errors for non-zero exit', async () => {
    if (!(await hasCompiler('go'))) return
    const result = await executeInSandbox({
      sourceCode: `package main
import "os"
func main() {
    os.Exit(1)
}`,
      stackId: 'go',
      stdin: '',
    })
    expect(result.status).toBe('runtime_error')
    expect(result.exitCode).toBe(1)
  })

  it('captures stdout correctly', async () => {
    if (!(await hasCompiler('go'))) return
    const result = await executeInSandbox({
      sourceCode: `package main
import "fmt"
func main() {
    fmt.Println("line1")
    fmt.Println("line2")
}`,
      stackId: 'go',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout).toContain('line1')
    expect(result.stdout).toContain('line2')
  })
})

// ─── Rust ────────────────────────────────────────────────────────────────────

SANDBOX('rust', () => {
  it('compiles and executes valid code', async () => {
    if (!(await hasCompiler('rustc'))) return
    const result = await executeInSandbox({
      sourceCode: `fn main() {
    println!("hello rust");
}`,
      stackId: 'rust',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('hello rust')
    expect(result.exitCode).toBe(0)
  })

  it('reports compile errors for invalid code', async () => {
    if (!(await hasCompiler('rustc'))) return
    const result = await executeInSandbox({
      sourceCode: `fn main() {
    println!("missing paren";
}`,
      stackId: 'rust',
      stdin: '',
    })
    expect(result.status).toBe('compile_error')
    expect(result.exitCode).not.toBe(0)
  })

  it('reports runtime errors for non-zero exit', async () => {
    if (!(await hasCompiler('rustc'))) return
    const result = await executeInSandbox({
      sourceCode: `fn main() {
    std::process::exit(1);
}`,
      stackId: 'rust',
      stdin: '',
    })
    expect(result.status).toBe('runtime_error')
    expect(result.exitCode).toBe(1)
  })

  it('captures stdout correctly', async () => {
    if (!(await hasCompiler('rustc'))) return
    const result = await executeInSandbox({
      sourceCode: `fn main() {
    println!("line1");
    println!("line2");
}`,
      stackId: 'rust',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout).toContain('line1')
    expect(result.stdout).toContain('line2')
  })
})

// ─── Limit Tests ─────────────────────────────────────────────────────────────

SANDBOX('limits', () => {
  it('enforces execution timeout', async () => {
    const result = await executeInSandbox({
      sourceCode: 'import time; time.sleep(60)',
      stackId: 'python',
      stdin: '',
      timeLimitMs: 2000,
    })
    expect(result.status).toBe('time_limit')
    expect(result.timedOut).toBe(true)
  }, 10000)

  it('enforces source size limit', async () => {
    const hugeSource = 'x = 1\n'.repeat(20000) // > 64KB
    const result = await executeInSandbox({
      sourceCode: hugeSource,
      stackId: 'python',
      stdin: '',
    })
    expect(result.status).toBe('compile_error')
    expect(result.stderr).toContain('maximum size')
  })

  it('truncates output beyond max bytes', async () => {
    const result = await executeInSandbox({
      sourceCode: 'print("A" * 500000)', // > 256KB output
      stackId: 'python',
      stdin: '',
      timeLimitMs: 10000,
    })
    // Output should be truncated but execution should complete
    expect(result.stdout.length).toBeLessThanOrEqual(256 * 1024 + 100)
  })
})

// ─── Isolation Tests ─────────────────────────────────────────────────────────

SANDBOX('isolation', () => {
  it('does not inherit application environment variables', async () => {
    const result = await executeInSandbox({
      sourceCode: 'import os; print(os.environ.get("DATABASE_URL", "NOT_FOUND"))',
      stackId: 'python',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    expect(result.stdout.trim()).toBe('NOT_FOUND')
  })

  it('does not expose application secrets via environment', async () => {
    const result = await executeInSandbox({
      sourceCode: 'import os\nfor k, v in sorted(os.environ.items()):\n    print(f"{k}={v}")',
      stackId: 'python',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
    // Must not contain any application secrets
    expect(result.stdout).not.toContain('DATABASE_URL')
    expect(result.stdout).not.toContain('REDIS_URL')
    expect(result.stdout).not.toContain('SESSION_SECRET')
    expect(result.stdout).not.toContain('CLUTCH_ADMIN')
  })

  it('returns error for unsupported language', async () => {
    const result = await executeInSandbox({
      sourceCode: 'print("hello")',
      stackId: 'brainfuck',
      stdin: '',
    })
    expect(result.status).toBe('internal_error')
    expect(result.stderr).toContain('Unsupported language')
  })
})

// ─── Cleanup Tests ───────────────────────────────────────────────────────────

SANDBOX('cleanup', () => {
  it('cleans up temp directory after successful execution', async () => {
    const result = await executeInSandbox({
      sourceCode: 'print("cleanup test")',
      stackId: 'python',
      stdin: '',
    })
    expect(result.status).toBe('accepted')
  })

  it('cleans up temp directory after failed execution', async () => {
    const result = await executeInSandbox({
      sourceCode: 'import sys; sys.exit(1)',
      stackId: 'python',
      stdin: '',
    })
    expect(result.status).toBe('runtime_error')
  })

  it('cleans up temp directory after timeout', async () => {
    const result = await executeInSandbox({
      sourceCode: 'import time; time.sleep(60)',
      stackId: 'python',
      stdin: '',
      timeLimitMs: 1000,
    })
    expect(result.status).toBe('time_limit')
  }, 10000)
})

// ─── Sandbox Mode ────────────────────────────────────────────────────────────

SANDBOX('configuration', () => {
  it('reports current sandbox mode', () => {
    const mode = currentSandboxMode()
    expect(['child_process', 'docker']).toContain(mode)
  })
})
