import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Firebase Admin, initialised from a base64-encoded service-account JSON.
 *
 * WHY BASE64: the service account's `private_key` is a PEM containing literal
 * newlines. Pasting raw JSON into a Vercel env var mangles those newlines and
 * produces the notoriously opaque "error:1E08010C:DECODER routines::unsupported"
 * at runtime. Base64 sidesteps the problem entirely.
 *
 * All server logic lives in Next.js route handlers rather than Firebase Cloud
 * Functions — Cloud Functions now require the paid Blaze plan, and keeping
 * logic on Vercel lets the project stay on Firebase's free Spark tier with no
 * card on file. This is a deliberate architectural decision, not an oversight.
 */

/**
 * Cached on globalThis, not in a module variable.
 *
 * Next.js hot-reload re-evaluates this module while the underlying Firebase app
 * survives. A module-level cache would therefore be reset to null even though
 * `getFirestore()` still returns the already-configured instance — and the
 * second `settings()` call throws "Firestore has already been initialized".
 * The same pattern also avoids re-initialising across warm serverless invocations.
 */
const globalForFirebase = globalThis as unknown as { __floodDb?: Firestore };

function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is not set (see .env.example)');
  }

  let parsed: { project_id?: string; client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64-encoded JSON');
  }

  const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = parsed;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Service account JSON missing project_id / client_email / private_key');
  }
  return { projectId, clientEmail, privateKey };
}

/**
 * The initialised Admin app.
 *
 * Exported because `getAuth()` and `getFirestore()` called with no argument
 * resolve the *default* app, which exists only once something has initialised
 * it. Anything reaching for Auth before the first `db()` call therefore threw
 * "The default Firebase app does not exist" — and since those call sites wrap
 * the lookup in a try/catch, the real cause was swallowed and reported as a
 * bad token or a missing user. Pass this explicitly instead of relying on
 * module evaluation order.
 */
export function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const { projectId, clientEmail, privateKey } = loadServiceAccount();
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

/** Firestore handle. Memoised so hot-reload and warm lambdas don't re-init. */
export function db(): Firestore {
  if (globalForFirebase.__floodDb) return globalForFirebase.__floodDb;

  const instance = getFirestore(adminApp());
  try {
    // Firestore rejects `undefined` by default; ignoring it lets us build
    // documents with optional fields without stripping keys by hand.
    instance.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already configured by a previous module instance — safe to continue.
  }

  globalForFirebase.__floodDb = instance;
  return instance;
}

export { Timestamp };

/** Collection names, centralised so a typo can't silently create a new collection. */
export const COLLECTIONS = {
  damReadings: 'damReadings',
  damLatest: 'damLatest',
  damDaily: 'damDaily',
  rainfallCache: 'rainfallCache',
  rainfallDaily: 'rainfallDaily',
  alerts: 'alerts',
  alertState: 'alertState',
  subscribers: 'subscribers',
  emailJobs: 'emailJobs',
  emailLog: 'emailLog',
  adminUsers: 'adminUsers',
  config: 'config',
  content: 'content',
} as const;
