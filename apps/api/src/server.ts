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
import { registerSocialRoutes } from './http/social-routes.js'
import { registerWsRoutes } from './ws/handler.js'

const isProduction = process.env.NODE_ENV === 'production'

// ---------------------------------------------------------------------------
// Production safety: require strong SESSION_SECRET
// ---------------------------------------------------------------------------
const INSECURE_SECRETS = new Set([
  'dev-secret-change-me',
  'secret',
  'change-me',
  'default-secret',
  'password',
  '',
])

if (isProduction) {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    console.error('FATAL: SESSION_SECRET is required in production')
    process.exit(1)
  }
  if (INSECURE_SECRETS.has(secret) || secret.length < 32) {
    console.error(
      'FATAL: SESSION_SECRET is too weak for production. ' +
      'It must be at least 32 characters and not a common default.',
    )
    process.exit(1)
  }
}

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
  secret: process.env.SESSION_SECRET ?? (isProduction ? '' : 'dev-secret-change-me'),
})

await app.register(websocket)

// ---------------------------------------------------------------------------
// Basic metrics (no sensitive user data exposed)
// ---------------------------------------------------------------------------
const requestCount = { total: 0, errors: 0 }
const requestLatencies: number[] = []
const requestStartTimes = new WeakMap<object, number>()

// ---------------------------------------------------------------------------
// Security headers + request ID + metrics timing
// ---------------------------------------------------------------------------
app.addHook('onRequest', async (request) => {
  const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID()
  request.id = requestId
  requestStartTimes.set(request, Date.now())
})

app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.header('X-XSS-Protection', '0')
  reply.header('X-Request-ID', _request.id)
  if (isProduction) {
    reply.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
})

app.decorate('db', db)
app.decorate('redis', redis)
app.decorate('pub', pub)
app.decorate('evalQueue', evalQueue)

app.setErrorHandler(handleError)

await registerHttpRoutes(app)
await registerDiscoveryRoutes(app)
await registerAdminRoutes(app)
await registerSocialRoutes(app)
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
    await withTimeout(redis.ping(), 5000)
    checks.redis = true
  } catch {
    checks.redis = false
  }
  try {
    const counts = await evalQueue.getJobCounts().catch(() => null)
    checks.evaluationQueue = counts === null ? true : (typeof counts.waiting === 'number')
  } catch {
    checks.evaluationQueue = true
  }

  const ok = Object.values(checks).every(Boolean)
  void reply.code(ok ? 200 : 503)
  return { ok, checks }
})

// ---------------------------------------------------------------------------
// Basic metrics endpoint (no sensitive user data exposed)
// ---------------------------------------------------------------------------
app.addHook('onResponse', async (request, reply) => {
  requestCount.total += 1
  if (reply.statusCode >= 500) requestCount.errors += 1
  const start = requestStartTimes.get(request) ?? Date.now()
  const latency = Date.now() - start
  requestLatencies.push(latency)
  if (requestLatencies.length > 1000) requestLatencies.shift()
})

app.get('/metrics', async () => {
  const queueCounts = await evalQueue.getJobCounts().catch(() => ({}))
  const latencyP50 = requestLatencies.length > 0
    ? requestLatencies.sort((a, b) => a - b)[Math.floor(requestLatencies.length * 0.5)]
    : 0
  const latencyP95 = requestLatencies.length > 0
    ? requestLatencies.sort((a, b) => a - b)[Math.floor(requestLatencies.length * 0.95)]
    : 0

  return {
    uptime: process.uptime(),
    requests: requestCount,
    latency: { p50: latencyP50, p95: latencyP95 },
    evaluationQueue: queueCounts,
  }
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
const isVitest = !!process.env.VITEST

if (!isVercel && !isVitest) {
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
