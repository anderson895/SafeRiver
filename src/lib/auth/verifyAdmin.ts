import 'server-only';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, db, COLLECTIONS } from '@/lib/firebase/admin';

export type AdminRole = 'SUPER_ADMIN' | 'DRRM_OFFICER' | 'VIEWER';

export interface AdminIdentity {
  uid: string;
  email: string | null;
  role: AdminRole;
  displayName: string | null;
}

export type AdminAuthResult =
  | { ok: true; admin: AdminIdentity }
  | { ok: false; status: 401 | 403; reason: string };

/**
 * Verifies that a request comes from an active admin.
 *
 * Every privileged route calls this. The client-side guard in the admin layout
 * only decides what to render — it is trivially bypassed by calling the API
 * directly, so it must never be the thing that protects an action. Authority
 * comes from the Firebase ID token verified here, checked against an active
 * record in `adminUsers`.
 *
 * A user existing in Firebase Auth is NOT sufficient. Anyone can create an
 * account against a public project; only a document in `adminUsers` with
 * `isActive: true` grants access, and that document cannot be written from a
 * browser (see firestore.rules).
 */
export async function verifyAdmin(req: Request): Promise<AdminAuthResult> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return { ok: false, status: 401, reason: 'Missing bearer token' };

  let decoded;
  try {
    // Pass the app explicitly. A bare getAuth() resolves the default app, which
    // is initialised lazily by db() on line 44 below — so on an invocation that
    // reached this route first, it threw, and the catch mislabelled an
    // initialisation failure as a rejected token.
    decoded = await getAuth(adminApp()).verifyIdToken(match[1]);
  } catch {
    return { ok: false, status: 401, reason: 'Invalid or expired session' };
  }

  const snap = await db().collection(COLLECTIONS.adminUsers).doc(decoded.uid).get();
  if (!snap.exists) {
    return { ok: false, status: 403, reason: 'This account is not an administrator' };
  }
  if (snap.get('isActive') !== true) {
    return { ok: false, status: 403, reason: 'This administrator account is disabled' };
  }

  return {
    ok: true,
    admin: {
      uid: decoded.uid,
      email: decoded.email ?? (snap.get('email') as string | null) ?? null,
      role: (snap.get('role') as AdminRole) ?? 'VIEWER',
      displayName: (snap.get('displayName') as string | null) ?? null,
    },
  };
}

/** Convenience wrapper returning a ready 401/403, or null when authorised. */
export async function adminGuard(
  req: Request,
  required: AdminRole[] = ['SUPER_ADMIN', 'DRRM_OFFICER'],
): Promise<{ response: Response } | { admin: AdminIdentity }> {
  const result = await verifyAdmin(req);
  if (!result.ok) {
    return { response: Response.json({ ok: false, error: result.reason }, { status: result.status }) };
  }
  if (!required.includes(result.admin.role)) {
    return {
      response: Response.json(
        { ok: false, error: 'Your role does not permit this action' },
        { status: 403 },
      ),
    };
  }
  return { admin: result.admin };
}
