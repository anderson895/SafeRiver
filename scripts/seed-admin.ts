/**
 * Grants administrator access to a Firebase Auth user.
 *
 *   npm run admin:grant -- someone@example.com
 *   npm run admin:grant -- someone@example.com --role VIEWER
 *   npm run admin:list
 *   npm run admin:revoke -- someone@example.com
 *
 * There is deliberately no way to do this from the browser. `adminUsers` is
 * server-only in firestore.rules, so privilege cannot be self-granted even by
 * someone who has signed in — anyone can create an account against a public
 * Firebase project, and account existence must not imply authority.
 *
 * The user must already exist in Firebase Authentication. Create them in the
 * console (Authentication > Users > Add user), then run this.
 */
import { getAuth } from 'firebase-admin/auth';
import { db, COLLECTIONS, Timestamp } from '../src/lib/firebase/admin';

type Role = 'SUPER_ADMIN' | 'DRRM_OFFICER' | 'VIEWER';
const ROLES: Role[] = ['SUPER_ADMIN', 'DRRM_OFFICER', 'VIEWER'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function list() {
  const snap = await db().collection(COLLECTIONS.adminUsers).get();
  if (snap.empty) {
    console.log('No administrators configured.');
    return;
  }
  console.log('email'.padEnd(34) + 'role'.padEnd(16) + 'active');
  for (const d of snap.docs) {
    console.log(
      String(d.get('email')).padEnd(34) +
        String(d.get('role')).padEnd(16) +
        (d.get('isActive') ? 'yes' : 'no'),
    );
  }
}

async function grant(email: string, role: Role, active: boolean) {
  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch {
    throw new Error(
      `No Firebase Auth user for ${email}.\n` +
        'Create the account first: Firebase Console > Authentication > Users > Add user.',
    );
  }

  await db()
    .collection(COLLECTIONS.adminUsers)
    .doc(user.uid)
    .set(
      {
        email,
        displayName: user.displayName ?? null,
        role,
        isActive: active,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

  console.log(
    active
      ? `Granted ${role} to ${email} (uid ${user.uid.slice(0, 8)}…)`
      : `Revoked access for ${email}`,
  );
}

async function main() {
  const mode = process.argv.includes('--list')
    ? 'list'
    : process.argv.includes('--revoke')
      ? 'revoke'
      : 'grant';

  if (mode === 'list') return list();

  // First positional argument that is not a flag or a flag's value.
  const email = process.argv.slice(2).find((a) => a.includes('@'));
  if (!email) throw new Error('Provide an email address, e.g. npm run admin:grant -- you@example.com');

  const role = (arg('role') ?? 'DRRM_OFFICER') as Role;
  if (!ROLES.includes(role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);

  await grant(email, role, mode !== 'revoke');
  console.log('');
  await list();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  });
