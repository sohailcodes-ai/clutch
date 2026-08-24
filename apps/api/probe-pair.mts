import 'dotenv/config'
import { Redis } from 'ioredis'
import { createDb, schema } from '@clutch/db'
import { eq } from 'drizzle-orm'
import { tryPairQueue } from '@clutch/domain'

async function main() {
  const db = createDb(process.env.DATABASE_URL!)
  const redis = new Redis(process.env.REDIS_URL!)
  const season = await db.query.seasons.findFirst({ where: eq(schema.seasons.status, 'active') })
  console.log('season:', season?.id)
  const match = await tryPairQueue(db, redis, season!.id, 'typescript')
  console.log('pair result:', match?.id ?? null)
  redis.disconnect()
  process.exit(0)
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
