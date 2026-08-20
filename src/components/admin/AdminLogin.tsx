'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import { useAdminAuth } from './AdminAuthProvider';

export default function AdminLogin() {
  const { signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      // Firebase error codes are not useful to an operator under pressure.
      const code = (err as { code?: string }).code ?? '';
      setError(
        /invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)
          ? 'Incorrect email or password.'
          : /too-many-requests/.test(code)
            ? 'Too many attempts. Wait a few minutes and try again.'
            : 'Could not sign in. Check your connection and try again.',
      );
      setBusy(false);
    }
  }

  return (
    <Stack sx={{ alignItems: 'center', py: 6 }}>
      <Card sx={{ maxWidth: 420, width: '100%' }}>
        <CardContent>
          <Stack spacing={1} sx={{ alignItems: 'center', mb: 3, textAlign: 'center' }}>
            <AdminPanelSettingsOutlined sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              DRRM Administrator
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to post advisories for San Manuel.
            </Typography>
          </Stack>

          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              <TextField
                required
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                autoComplete="username"
                fullWidth
              />
              <TextField
                required
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                autoComplete="current-password"
                fullWidth
              />

              {error && <Alert severity="error">{error}</Alert>}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={busy || !email || !password}
                startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>

              <Typography variant="caption" color="text.secondary">
                Accounts are created by the system administrator. Signing in with an account that
                has not been granted administrator access will be refused.
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
