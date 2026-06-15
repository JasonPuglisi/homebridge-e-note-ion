import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { API, Logging } from 'homebridge';

const HASH_PREFIX = 'sha256:';

/** Generate a new random push secret (URL-safe, ~192 bits of entropy). */
export function generateSecret(): string {
  return randomBytes(24).toString('base64url');
}

/** Hash a plaintext secret into the stored form (`sha256:<hex>`). */
export function hashSecret(plaintext: string): string {
  return HASH_PREFIX + createHash('sha256').update(plaintext).digest('hex');
}

/** True if a stored config value is already a hash produced by hashSecret(). */
export function isHash(value: string): boolean {
  return value.startsWith(HASH_PREFIX);
}

/** Constant-time check that the `provided` plaintext matches `storedHash`. */
export function verifySecret(provided: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(provided));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Write `hash` into this platform's `pushSecret` field in config.json so it
 * persists across restarts (and the user can clear the field to rotate).
 *
 * Best-effort: a high-entropy random secret is safe to keep only as a hash, and
 * if the write fails (read-only fs, permissions) the in-memory hash still works
 * for this session — it just regenerates on the next restart.
 */
export function persistHashToConfig(api: API, platformName: string, hash: string, log: Logging): void {
  try {
    const path = api.user.configPath();
    const config = JSON.parse(readFileSync(path, 'utf8')) as { platforms?: Array<Record<string, unknown>> };
    const block = (config.platforms || []).find((p) => p.platform === platformName);
    if (!block) {
      log.warn('Could not locate this platform in config.json to persist the push secret hash.');
      return;
    }
    block.pushSecret = hash;
    writeFileSync(path, `${JSON.stringify(config, null, 4)}\n`);
  } catch (e) {
    log.warn(`Could not persist the push secret to config.json (${(e as Error).message}); it will regenerate next restart.`);
  }
}
