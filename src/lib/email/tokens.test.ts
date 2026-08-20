import { describe, it, expect, beforeAll } from 'vitest';
import { makeToken, verifyToken, subscriberId, isPlausibleEmail } from './tokens';

beforeAll(() => {
  process.env.TOKEN_SECRET = 'test-secret-not-the-real-one';
});

const NOW = new Date('2026-08-20T08:00:00Z');
const ID = subscriberId('resident@example.com');

describe('subscriberId', () => {
  it('is stable and case-insensitive, so re-subscribing updates one document', () => {
    expect(subscriberId('Resident@Example.com ')).toBe(subscriberId('resident@example.com'));
  });

  it('does not contain the raw address', () => {
    expect(subscriberId('resident@example.com')).not.toContain('resident');
  });
});

describe('token round-trip', () => {
  it('verifies a freshly issued confirm token', () => {
    const r = verifyToken('confirm', makeToken('confirm', ID, NOW), NOW);
    expect(r.valid).toBe(true);
    expect(r.subscriberId).toBe(ID);
  });

  it('verifies an unsubscribe token', () => {
    expect(verifyToken('unsubscribe', makeToken('unsubscribe', ID, NOW), NOW).valid).toBe(true);
  });
});

describe('token abuse resistance', () => {
  it('rejects an unsubscribe token replayed as a confirmation', () => {
    const token = makeToken('unsubscribe', ID, NOW);
    const r = verifyToken('confirm', token, NOW);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('bad-signature');
  });

  it('rejects a tampered subscriber id', () => {
    const token = makeToken('confirm', ID, NOW);
    const other = subscriberId('someone-else@example.com');
    const forged = `${other}.${token.split('.')[1]}.${token.split('.')[2]}`;
    expect(verifyToken('confirm', forged, NOW).valid).toBe(false);
  });

  it('rejects a tampered expiry, so a token cannot extend its own lifetime', () => {
    const token = makeToken('confirm', ID, NOW);
    const [id, , mac] = token.split('.');
    const extended = `${id}.${NOW.getTime() + 10 * 365 * 24 * 3600_000}.${mac}`;
    expect(verifyToken('confirm', extended, NOW).valid).toBe(false);
  });

  it('rejects malformed input', () => {
    for (const bad of ['', 'x', 'a.b', 'a.b.c.d', null, undefined]) {
      expect(verifyToken('confirm', bad as string, NOW).valid).toBe(false);
    }
  });
});

describe('token expiry', () => {
  it('confirm tokens expire after 48 hours', () => {
    const token = makeToken('confirm', ID, NOW);
    const later = new Date(NOW.getTime() + 49 * 3600_000);
    const r = verifyToken('confirm', token, later);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('expired');
  });

  it('confirm tokens still work just inside the window', () => {
    const token = makeToken('confirm', ID, NOW);
    const later = new Date(NOW.getTime() + 47 * 3600_000);
    expect(verifyToken('confirm', token, later).valid).toBe(true);
  });

  it('unsubscribe tokens never expire, because they live in every email sent', () => {
    const token = makeToken('unsubscribe', ID, NOW);
    const muchLater = new Date(NOW.getTime() + 5 * 365 * 24 * 3600_000);
    expect(verifyToken('unsubscribe', token, muchLater).valid).toBe(true);
  });
});

describe('email plausibility', () => {
  const good = ['a@b.ph', 'juan.dela.cruz@gmail.com', 'x+tag@sub.domain.org'];
  const bad = ['', 'no-at-sign', 'a@b', 'a b@c.com', '@b.com', 'a@.com', `${'x'.repeat(250)}@b.com`];

  for (const e of good) it(`accepts ${e}`, () => expect(isPlausibleEmail(e)).toBe(true));
  for (const e of bad) {
    it(`rejects ${JSON.stringify(e)}`, () => expect(isPlausibleEmail(e)).toBe(false));
  }
});
