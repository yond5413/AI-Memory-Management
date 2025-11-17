/** Neo4j client and connection management. */
import neo4j, { Driver, Session, Result } from 'neo4j-driver';
import { getEnv, getEnvOrThrow } from '../utils';

let driver: Driver | null = null;

/**
 * Get Neo4j driver instance.
 * Creates a singleton connection on first call.
 */
export function getDriver(): Driver {
  if (driver === null) {
    const uri = getEnvOrThrow('NEO4J_URI');
    const username = getEnvOrThrow('NEO4J_USERNAME');
    const password = getEnvOrThrow('NEO4J_PASSWORD');
    
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  }
  return driver;
}

/**
 * Execute a read query and return results.
 */
export async function executeRead<T = any>(
  cypher: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const driver = getDriver();
  const session = driver.session();
  
  try {
    const result = await session.executeRead(tx => 
      tx.run(cypher, params)
    );
    
    return result.records.map(record => record.toObject() as T);
  } finally {
    await session.close();
  }
}

/**
 * Execute a write query and return results.
 */
export async function executeWrite<T = any>(
  cypher: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const driver = getDriver();
  const session = driver.session();
  
  try {
    const result = await session.executeWrite(tx => 
      tx.run(cypher, params)
    );
    
    return result.records.map(record => record.toObject() as T);
  } finally {
    await session.close();
  }
}

/**
 * Execute a query with a custom session.
 * Use this for more complex transaction management.
 */
export async function withSession<T>(
  operation: (session: Session) => Promise<T>
): Promise<T> {
  const driver = getDriver();
  const session = driver.session();
  
  try {
    return await operation(session);
  } finally {
    await session.close();
  }
}

/**
 * Close Neo4j connection.
 * Useful for cleanup in tests or shutdown handlers.
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Test Neo4j connection.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const driver = getDriver();
    await driver.verifyConnectivity();
    return true;
  } catch (error) {
    console.error('Neo4j connection test failed:', error);
    return false;
  }
}

