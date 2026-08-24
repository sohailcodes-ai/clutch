import { Redis } from 'ioredis'

async function main() {
  const r = new Redis('redis://localhost:6379')
  const keys = await r.keys('queue:*')
  console.log('keys:', JSON.stringify(keys))
  for (const key of keys) {
    if (!key.includes('meta') && !key.includes('lock')) {
      console.log(key, await r.zrange(key, 0, -1))
    }
  }
  const locks = await r.keys('lock:pair:*')
  console.log('stale locks:', JSON.stringify(locks))
  r.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
