import type { GlobalSetupContext } from 'vitest/node'

process.env.NODE_ENV = 'development'
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://clutch:clutch@localhost:5432/clutch'
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
process.env.SESSION_SECRET = 'e2e-test-secret-at-least-32-characters-long'
process.env.SANDBOX_MODE = 'child_process'
process.env.EMAIL_MODE = 'log'
process.env.API_PORT = '4999'
process.env.API_HOST = '127.0.0.1'
process.env.CORS_ORIGIN = 'http://localhost:3000'
process.env.EVALUATION_CONCURRENCY = '2'

export async function setup() {
  const { app } = await import('../../apps/api/src/server.js')

  // Flush rate-limit keys so both test files get a full quota
  const redis = app.redis as unknown as { keys: (pattern: string) => Promise<string[]>; del: (...keys: string[]) => Promise<number> }
  const keys = await redis.keys('ratelimit:*')
  if (keys.length) await redis.del(...keys)

  const port = Number(process.env.API_PORT)
  const host = process.env.API_HOST ?? '127.0.0.1'
  await app.listen({ port, host })
}

export async function teardown() {
  try {
    const { app } = await import('../../apps/api/src/server.js')
    await app.close()
  } catch {}
}
