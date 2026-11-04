import crypto from "crypto";
import env from "@server/env";

const KEY_LENGTH = 32;
const UNLOCK_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Hash a share password using scrypt with a random salt.
 *
 * @param password The plain text password.
 * @returns The encoded hash in the form `scrypt$<salt>$<hash>`.
 */
export function hashSharePassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/**
 * Verify a plain text password against an encoded share password hash.
 *
 * @param password The plain text password.
 * @param encoded The stored hash.
 * @returns True if the password matches.
 */
export function verifySharePassword(
  password: string,
  encoded: string
): boolean {
  const [scheme, salt, hash] = encoded.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

/** The cookie that holds the unlock token for a password protected share. */
export function shareUnlockCookieName(shareId: string): string {
  return `shareUnlock-${shareId}`;
}

function sign(shareId: string, passwordHash: string, expiresAt: number) {
  return crypto
    .createHmac("sha256", env.SECRET_KEY)
    .update(`${shareId}:${passwordHash}:${expiresAt}`)
    .digest("base64url");
}

/**
 * Create an unlock token that proves the share password was entered. The token
 * is bound to the current password hash, so changing the password invalidates it.
 *
 * @returns The token and its expiry date.
 */
export function createShareUnlockToken(shareId: string, passwordHash: string) {
  const expiresAt = Date.now() + UNLOCK_TTL_MS;
  return {
    token: `${expiresAt}.${sign(shareId, passwordHash, expiresAt)}`,
    expires: new Date(expiresAt),
  };
}

/**
 * Check an unlock token created by `createShareUnlockToken`.
 *
 * @returns True if the token is valid for the share and not expired.
 */
export function verifyShareUnlockToken(
  token: string | undefined,
  shareId: string,
  passwordHash: string
): boolean {
  if (!token) {
    return false;
  }
  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!signature || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }
  const expected = Buffer.from(sign(shareId, passwordHash, expiresAt));
  const actual = Buffer.from(signature);
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}
