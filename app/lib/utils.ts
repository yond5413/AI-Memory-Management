/** Utility functions for ID generation and other helpers. */

/**
 * Generate a short, prefixed UUID-based ID.
 * 
 * @param prefix - One of "mem", "rel", "vec", "ent"
 * @returns A prefixed ID like "mem_3fa2b1"
 */
export function genId(prefix: "mem" | "rel" | "vec" | "ent" = "mem"): string {
  // Generate random bytes (equivalent to uuid.uuid4().bytes)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  
  // Convert to base64 URL-safe and take first 8 characters
  const base64 = Buffer.from(array).toString('base64url').substring(0, 8);
  
  return `${prefix}_${base64}`;
}

/**
 * Get environment variable or throw error if not found.
 */
export function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get environment variable with optional default.
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}


