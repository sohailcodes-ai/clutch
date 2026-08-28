import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'
import * as relations from './schema/relations.js'

const fullSchema = { ...schema, ...relations }

let client: ReturnType<typeof postgres> | null = null
let db: ReturnType<typeof drizzle<typeof fullSchema>> | null = null

export function createDb(connectionString: string) {
  if (db) return db
  client = postgres(connectionString, { max: 10, connect_timeout: 5 })
  db = drizzle(client, { schema: fullSchema })
  return db
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call createDb() first.')
  }
  return db
}

export async function closeDb() {
  if (client) {
    await client.end()
    client = null
    db = null
  }
}

export type Database = ReturnType<typeof createDb>

/** The transaction object passed to `db.transaction(async (tx) => ...)`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Anything that can execute queries: the root database handle or a transaction.
 * Domain functions that participate in a transaction must accept this type
 * instead of `Database` so callers can safely pass `tx` without casting.
 */
export type DbExecutor = Database | Transaction

export { schema }
