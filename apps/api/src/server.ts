import 'dotenv/config'
import type { IncomingMessage, ServerResponse } from 'node:http'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import websocket from '@fastify/websocket'
import { Redis } from 'ioredis'
import { Queue } from 'bullmq'
import { sql } from '@clutch/db'
import { createDb } from '@clutch/db'
import { createEvaluationQueue, EVALUATION_QUEUE_NAME } from '@clutch/domain'
import type { EvaluationJobData } from '@clutch/domain'
import { handleError } from './middleware/auth.js'
import { registerHttpRoutes } from './http/routes.js'
import { registerDiscoveryRoutes } from './http/discovery-routes.js'
import { registerAdminRoutes } from './http/admin-routes.js'
import { registerWsRoutes } from './ws/handler.js'

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL

if (!databaseUrl) throw new Error('DATABASE_URL is required')
if (!redisUrl) throw new Error('REDIS_URL is required')

const db = createDb(databaseUrl)

const parsedRedisUrl = new URL(redisUrl)
const redisHost = parsedRedisUrl.hostname
const redisPort = Number(parsedRedisUrl.port || 6379)
const redisPass = decodeURIComponent(parsedRedisUrl.password)
const useTls = parsedRedisUrl.protocol === 'rediss:'

const redisOptions = {
  host: redisHost,
  port: redisPort,
  password: redisPass,
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  maxRetriesPerRequest: 20,
  connectTimeout: 5000,
  enableReadyCheck: true,
  lazyConnect: true,
  tls: useTls ? {} : undefined,
}
const redis = new Redis(redisOptions)
const pub = new Redis(redisOptions)

const evalQueue = createEvaluationQueue(redisUrl)

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

app.get('/ready', async (request, reply) => {
  const checks: Record<string, boolean> = { api: true }
  try {
    await withTimeout(db.execute(sql`select 1`), 5000)
    checks.database = true
  } catch {
    checks.database = false
  }
  try {
    if (redis.status !== 'ready') await withTimeout(redis.connect(), 5000)
    checks.redis = (await withTimeout(redis.ping(), 5000)) === 'PONG'
  } catch {
    checks.redis = false
  }
  try {
    const counts = await withTimeout(evalQueue.getJobCounts(), 5000)
    checks.evaluationQueue = typeof counts.waiting === 'number'
  } catch {
    checks.evaluationQueue = false
  }

  const ok = Object.values(checks).every(Boolean)
  void reply.code(ok ? 200 : 503)
  return { ok, checks }
})

await app.ready()

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof createDb>
    redis: Redis
    pub: Redis
    evalQueue: Queue<EvaluationJobData>
  }
}

const isVercel = !!process.env.VERCEL

if (!isVercel) {
  const port = Number(process.env.API_PORT ?? 4000)
  const host = process.env.API_HOST ?? '0.0.0.0'
  try {
    await app.listen({ port, host })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await app.ready()
  app.server.emit('request', req, res)
}

export { app, EVALUATION_QUEUE_NAME }
