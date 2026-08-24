import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import websocket from '@fastify/websocket'
import { Redis } from 'ioredis'
import { Queue } from 'bullmq'
import { sql } from 'drizzle-orm'
import { createDb } from '@clutch/db'
import { createEvaluationQueue, EVALUATION_QUEUE_NAME } from '@clutch/domain'
import type { EvaluationJobData } from '@clutch/domain'
import { handleError } from './middleware/auth.js'
import { registerHttpRoutes } from './http/routes.js'
import { registerDiscoveryRoutes } from './http/discovery-routes.js'
import { registerAdminRoutes } from './http/admin-routes.js'
import { registerWsRoutes } from './ws/handler.js'

const port = Number(process.env.API_PORT ?? 4000)
const host = process.env.API_HOST ?? '0.0.0.0'
const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL

if (!databaseUrl) throw new Error('DATABASE_URL is required')
if (!redisUrl) throw new Error('REDIS_URL is required')

const db = createDb(databaseUrl)
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => Math.min(times * 200, 5000),
  maxRetriesPerRequest: 20,
})
const pub = new Redis(redisUrl, {
  retryStrategy: (times) => Math.min(times * 200, 5000),
  maxRetriesPerRequest: 20,
})

// Producer-only connection: the API enqueues evaluation jobs but never runs them.
const evalQueue = createEvaluationQueue(redisUrl)

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
})

await app.register(cookie, {
  secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
})

await app.register(websocket)

app.decorate('db', db)
app.decorate('redis', redis)
app.decorate('pub', pub)
app.decorate('evalQueue', evalQueue)

app.setErrorHandler(handleError)

await registerHttpRoutes(app)
await registerDiscoveryRoutes(app)
await registerAdminRoutes(app)
await registerWsRoutes(app)

app.get('/health', async () => ({ ok: true }))

app.get('/ready', async (request, reply) => {
  const checks: Record<string, boolean> = { api: true }
  try {
    await db.execute(sql`select 1`)
    checks.database = true
  } catch {
    checks.database = false
  }
  try {
    checks.redis = (await redis.ping()) === 'PONG'
  } catch {
    checks.redis = false
  }
  try {
    const counts = await evalQueue.getJobCounts()
    checks.evaluationQueue = typeof counts.waiting === 'number'
  } catch {
    checks.evaluationQueue = false
  }

  const ok = Object.values(checks).every(Boolean)
  void reply.code(ok ? 200 : 503)
  return { ok, checks }
})

try {
  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof createDb>
    redis: Redis
    pub: Redis
    evalQueue: Queue<EvaluationJobData>
  }
}

export { EVALUATION_QUEUE_NAME }
