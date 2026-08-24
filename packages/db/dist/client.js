import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import * as relations from './schema/relations.js';
const fullSchema = { ...schema, ...relations };
let client = null;
let db = null;
export function createDb(connectionString) {
    if (db)
        return db;
    client = postgres(connectionString, { max: 10 });
    db = drizzle(client, { schema: fullSchema });
    return db;
}
export function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call createDb() first.');
    }
    return db;
}
export async function closeDb() {
    if (client) {
        await client.end();
        client = null;
        db = null;
    }
}
export { schema };
//# sourceMappingURL=client.js.map