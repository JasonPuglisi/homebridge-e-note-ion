import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { API, Logging } from 'homebridge';

const SCRYPT_PREFIX = 'scrypt:';
const KEYLEN = 32;

/** Generate a new random push secret (URL-safe, ~192 bits of entropy). */
export function generateSecret(): string {
  return randomBytes(24).toString('base64url');
}

/** Hash a plaintext secret for storage: `scrypt:<saltHex>:<keyHex>`. */
export function hashSecret(plaintext: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(plaintext, salt, KEYLEN);
  return `${SCRYPT_PREFIX}${salt.toString('hex')}:${key.toString('hex')}`;
}

/** True if a stored value is a hash this plugin produced. */
export function isHash(value: string): boolean {
  return value.startsWith(SCRYPT_PREFIX);
}

/** Constant-time check that the `provided` plaintext matches `storedHash`. */
export function verifySecret(provided: string, storedHash: string): boolean {
  if (!storedHash.startsWith(SCRYPT_PREFIX)) {
    return false;
  }
  const [, saltHex, keyHex] = storedHash.split(':');
  if (!saltHex || !keyHex) {
    return false;
  }
  const expected = Buffer.from(keyHex, 'hex');
  let actual: Buffer;
  try {
    actual = scryptSync(provided, Buffer.from(saltHex, 'hex'), expected.length);
  } catch {
    return false;
  }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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
