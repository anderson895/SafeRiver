/**
 * Grants administrator access to a Firebase Auth user.
 *
 *   npm run admin:grant  -- someone@example.com SUPER_ADMIN   (must already exist)
 *   npm run admin:create -- someone@example.com <password> SUPER_ADMIN
 *   npm run admin:list
 *   npm run admin:revoke -- someone@example.com
 *
 * There is deliberately no way to do this from the browser. `adminUsers` is
 * server-only in firestore.rules, so privilege cannot be self-granted even by
 * someone who has signed in — anyone can create an account against a public
 * Firebase project, and account existence must not imply authority.
 *
 * `admin:create` also creates the Authentication account. It carries the
 * `--create` switch inside package.json rather than expecting the caller to
 * pass it: npm parses unrecognised `--flags` as its own config and strips them
 * before the script sees them, which is why `--role` never arrived.
 */
import { getAuth } from 'firebase-admin/auth';
import { adminApp, db, COLLECTIONS, Timestamp } from '../src/lib/firebase/admin';

type Role = 'SUPER_ADMIN' | 'DRRM_OFFICER' | 'VIEWER';
const ROLES: Role[] = ['SUPER_ADMIN', 'DRRM_OFFICER', 'VIEWER'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const isRole = (a: string) => (ROLES as readonly string[]).includes(a.toUpperCase());

/** Bare arguments, with flags and any values they consume removed. */
function positionals(): string[] {
  const argv = process.argv.slice(2);
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      if (argv[i] === '--role' || argv[i] === '--password') i += 1; // consumes a value
      continue;
    }
    out.push(argv[i]);
  }
  return out;
}

/**
 * Email, role and password from the command line.
 *
 * Positionals rather than flags, because npm treats an unrecognised `--role`
 * as its own config and strips it before the script runs — which silently
 * downgraded grants to the default role while printing only a warning.
 */
function parseArgs(): { email?: string; role: Role; password?: string } {
  const pos = positionals();
  const emailIdx = pos.findIndex((a) => a.includes('@'));

  // Filtered by INDEX, not by value: a password may legitimately be identical
  // to the email, and filtering by value would discard both.
  const rest = pos.filter((_, i) => i !== emailIdx);

  const role = (arg('role') ?? rest.find(isRole) ?? 'DRRM_OFFICER').toUpperCase() as Role;
  if (!ROLES.includes(role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);

  return {
    email: emailIdx === -1 ? undefined : pos[emailIdx],
    role,
    password: arg('password') ?? process.env.ADMIN_PASSWORD ?? rest.find((a) => !isRole(a)),
  };
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

async function grant(email: string, role: Role, active: boolean, password?: string) {
  // Explicit app: nothing has touched db() yet at this point, so a bare
  // getAuth() would find no default app and fail before the lookup runs.
  const auth = getAuth(adminApp());
  const projectId = auth.app.options.projectId ?? '(unknown)';

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    if (process.argv.includes('--create')) {
      if (!password) {
        throw new Error(
          `No account for ${email} in "${projectId}", and no password was given to create one.\n` +
            'Usage: npm run admin:create -- you@example.com <password> SUPER_ADMIN',
        );
      }
      try {
        // emailVerified: this account is provisioned by an operator with
        // service-account credentials, so there is no address to prove control
        // of — leaving it false would only add a warning nobody can clear.
        user = await auth.createUser({ email, password, emailVerified: true });
      } catch (createErr) {
        const detail = createErr instanceof Error ? createErr.message : String(createErr);
        throw new Error(`Could not create ${email}: ${detail}`);
      }
      console.log(`Created Auth account ${email} in "${projectId}".`);
    } else {
      // Name the project that was searched, and who is actually in it. The
      // usual cause is not a missing account but FIREBASE_SERVICE_ACCOUNT_B64
      // pointing at a different project than NEXT_PUBLIC_FIREBASE_PROJECT_ID —
      // in which case the account is plainly visible in the browser while this
      // lookup fails, which is baffling without being told where it looked.
      let known = '';
      try {
        const { users } = await auth.listUsers(10);
        known = users.length
          ? `\n\nAccounts that DO exist in "${projectId}":\n` +
            users.map((u) => `  - ${u.email ?? '(no email)'}  uid ${u.uid.slice(0, 8)}…`).join('\n')
          : `\n\nProject "${projectId}" has no Authentication users at all.`;
      } catch {
        /* listing is best-effort; the main message still stands */
      }
      throw new Error(
        `No Firebase Auth user for ${email} in project "${projectId}".\n\n` +
          'To create it as well, use:\n' +
          `  npm run admin:create -- ${email} <password> ${role}\n\n` +
          'If the account plainly exists in the browser, confirm\n' +
          'FIREBASE_SERVICE_ACCOUNT_B64 is for the SAME project as\n' +
          'NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local.' +
          known,
      );
    }
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

/** Resets an existing account's password. Does not touch its role. */
async function setPassword(email: string, password: string) {
  const auth = getAuth(adminApp());
  const user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password });
  console.log(`Password updated for ${email}.`);
}

async function main() {
  const mode = process.argv.includes('--list')
    ? 'list'
    : process.argv.includes('--revoke')
      ? 'revoke'
      : process.argv.includes('--set-password')
        ? 'password'
        : 'grant';

  if (mode === 'list') return list();

  if (mode === 'password') {
    const { email: e, password: p } = parseArgs();
    if (!e || !p) throw new Error('Usage: npm run admin:password -- you@example.com <new-password>');
    return setPassword(e, p);
  }

  const { email, role, password } = parseArgs();
  if (!email) throw new Error('Provide an email address, e.g. npm run admin:grant -- you@example.com');

  await grant(email, role, mode !== 'revoke', password);
  console.log('');
  await list();

  // This grants authority to publish advisories to real subscribers, against
  // the same Firebase project production uses. A guessable password here is a
  // route to broadcasting a fake flood warning, so say so plainly rather than
  // leaving it to be noticed later.
  // Length is the wrong measure here — guessability is. A password equal to the
  // account name is the first thing anyone tries, and passes any length rule.
  const weak = password && (password.length < 12 || password.toLowerCase() === email.toLowerCase());
  if (weak) {
    console.log('');
    console.log('WARNING: this password is guessable (it matches the email, or is short).');
    console.log('         This account can publish flood advisories to real subscribers');
    console.log('         on the same Firebase project production uses. Change it before');
    console.log('         the system is used for real:');
    console.log(`           npm run admin:password -- ${email} <new-password>`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  });
