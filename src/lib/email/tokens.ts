import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Stateless, signed tokens for confirm and unsubscribe links.
 *
 * The token carries the subscriber id and an expiry, signed with TOKEN_SECRET.
 * Two consequences worth noting:
 *
 *  - Verification is a direct document read, not a Firestore query on a token
 *    field. No index to define, and no way to enumerate subscribers by probing.
 *  - The purpose is part of the signed payload, so an unsubscribe link can
 *    never be replayed as a confirmation link (or vice versa).
 *
 * Single-use semantics for confirmation are enforced by state, not by the
 * token: a subscriber already ACTIVE simply ignores a replayed confirm link.
 */
export type TokenPurpose = 'confirm' | 'unsubscribe';

const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s) throw new Error('TOKEN_SECRET is not set (see .env.example)');
  return s;
}

/**
 * Subscriber document id.
 *
 * Deriving it from the address means one address maps to exactly one document,
 * so re-subscribing updates rather than duplicates. Hashing keeps the raw
 * address out of document ids, which show up in logs and URLs.
 */
export function subscriberId(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function makeToken(purpose: TokenPurpose, id: string, now: Date = new Date()): string {
  // Unsubscribe links live in every email forever, so they must not expire.
  const expiresAt = purpose === 'confirm' ? now.getTime() + CONFIRM_TTL_MS : 0;
  const payload = `${purpose}:${id}:${expiresAt}`;
  return `${id}.${expiresAt}.${sign(payload)}`;
}

export interface TokenResult {
  valid: boolean;
  subscriberId?: string;
  reason?: 'malformed' | 'bad-signature' | 'expired';
}

export function verifyToken(
  purpose: TokenPurpose,
  token: string | null | undefined,
  now: Date = new Date(),
): TokenResult {
  if (!token) return { valid: false, reason: 'malformed' };

  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };

  const [id, expiresRaw, mac] = parts;
  const expiresAt = Number(expiresRaw);
  if (!/^[a-f0-9]{64}$/.test(id) || !Number.isFinite(expiresAt)) {
    return { valid: false, reason: 'malformed' };
  }

  const expected = sign(`${purpose}:${id}:${expiresAt}`);
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // Constant-time compare; a length mismatch is itself a failure.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad-signature' };
  }

  if (expiresAt !== 0 && now.getTime() > expiresAt) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, subscriberId: id };
}

/** Basic address sanity check. Real validation is the confirmation email. */
export function isPlausibleEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Emails are personal data; logs store a hash so they cannot be read back. */
export function hashEmail(email: string): string {
  return subscriberId(email).slice(0, 32);
}
