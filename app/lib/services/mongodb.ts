/** MongoDB client and connection management. */
import { MongoClient, Db } from 'mongodb';
import { getEnv, getEnvOrThrow } from '../utils';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Get MongoDB database instance.
 * Creates a singleton connection on first call.
 */
export function getDb(): Db {
  if (db === null) {
    const uri = getEnv('MONGODB_URI') || 'mongodb://localhost:27017';
    const dbName = getEnv('MONGODB_DB_NAME') || 'memory_db';
    
    client = new MongoClient(uri);
    // Note: MongoClient lazy connects on first operation in Node.js driver
    db = client.db(dbName);
  }
  return db;
}

/**
 * Close MongoDB connection.
 * Useful for cleanup in tests or shutdown handlers.
 */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

/**
 * Test MongoDB connection.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const database = getDb();
    await database.command({ ping: 1 });
    return true;
  } catch (error) {
    console.error('MongoDB connection test failed:', error);
    return false;
  }
}

