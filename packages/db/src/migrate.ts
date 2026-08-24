import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDb, closeDb } from './client.js'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  const db = createDb(url)
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations applied successfully')
  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
