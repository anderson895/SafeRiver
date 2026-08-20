'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import MarkEmailReadOutlined from '@mui/icons-material/MarkEmailReadOutlined';
import PageHeader from '@/components/common/PageHeader';
import { useI18n } from '@/i18n/I18nProvider';

const BARANGAYS = [
  'Cabacaraan', 'Cabaritan', 'Flores', 'Guiset Norte', 'Guiset Sur',
  'Lapalo', 'Nagsaag', 'Narra', 'San Antonio-Arzadon', 'San Bonifacio',
  'San Juan', 'San Roque', 'San Vicente', 'Santo Domingo',
];

export default function SubscribePage() {
  const { dict, lang } = useI18n();
  const [email, setEmail] = useState('');
  const [barangay, setBarangay] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const isTl = lang === 'tl';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, language: lang, barangay: barangay || null }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'Subscription failed');
      setState('sent');
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <>
        <PageHeader title={dict.nav.subscribe} subtitle={dict.app.tagline} />
        <Card sx={{ maxWidth: 560 }}>
          <CardContent>
            <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 4 }}>
              <MarkEmailReadOutlined sx={{ fontSize: 48, color: 'success.main' }} />
              <Typography variant="h6">
                {isTl ? 'Tingnan ang inyong email' : 'Check your email'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                {isTl
                  ? `Nagpadala kami ng confirmation link sa ${email}. Kailangan itong i-click bago magsimula ang mga babala.`
                  : `We sent a confirmation link to ${email}. You must click it before any alerts are sent.`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isTl
                  ? 'Kung wala sa Inbox, tingnan ang Spam folder at markahang "Not spam".'
                  : 'If it is not in your Inbox, check your Spam folder and mark it "Not spam".'}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={dict.nav.subscribe} subtitle={dict.app.tagline} />

      <Card sx={{ maxWidth: 560 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {isTl
              ? 'Makakatanggap kayo ng email kapag may pagpapakawala ng tubig sa San Roque Dam, tumaas ang lebel ng tubig, o may malakas na ulan sa San Manuel.'
              : 'Get an email when San Roque Dam releases water, reservoir levels rise, or heavy rain is expected over San Manuel.'}
          </Typography>

          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              <TextField
                required
                type="email"
                label={isTl ? 'Email address' : 'Email address'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state === 'sending'}
                fullWidth
                autoComplete="email"
              />

              <TextField
                select
                label={isTl ? 'Barangay (opsyonal)' : 'Barangay (optional)'}
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                disabled={state === 'sending'}
                fullWidth
                helperText={
                  isTl
                    ? 'Ginagamit para gawing mas tiyak ang mga babala.'
                    : 'Used to make alerts more specific to your area.'
                }
              >
                <MenuItem value="">
                  <em>{isTl ? 'Hindi tukoy' : 'Not specified'}</em>
                </MenuItem>
                {BARANGAYS.map((b) => (
                  <MenuItem key={b} value={b}>{b}</MenuItem>
                ))}
              </TextField>

              {error && <Alert severity="error">{error}</Alert>}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={state === 'sending' || !email}
                startIcon={state === 'sending' ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {state === 'sending'
                  ? isTl ? 'Ipinapadala…' : 'Sending…'
                  : isTl ? 'Magpa-abiso' : 'Subscribe to alerts'}
              </Button>

              {/* RA 10173 requires that people know what is collected and why,
                  before they consent — not buried in a policy page. */}
              <Typography variant="caption" color="text.secondary">
                {isTl
                  ? 'Ang inyong email ay gagamitin lamang para sa mga babala tungkol sa baha. Hindi ito ibinebenta o ibinabahagi. Maaari kayong mag-unsubscribe anumang oras gamit ang link sa bawat email. Ayon sa Data Privacy Act (RA 10173), itinatala namin ang oras ng inyong pagpayag.'
                  : 'Your email is used only for flood alerts. It is never sold or shared. You can unsubscribe at any time using the link in every email. Under the Data Privacy Act (RA 10173), we record when you gave consent.'}
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
