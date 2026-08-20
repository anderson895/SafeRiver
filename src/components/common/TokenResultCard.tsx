'use client';

import { useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import Link from 'next/link';

type Phase = 'working' | 'ok' | 'fail';

export interface TokenCopy {
  working: string;
  okTitle: string;
  okBody: string;
  failTitle: string;
  /** Keyed by the `reason` the API returns, with a catch-all. */
  failBody: Record<string, string> & { default: string };
  homeCta: string;
}

/**
 * Shared UI for the confirm and unsubscribe landing pages.
 *
 * Both are reached by clicking a link in an email, so they must explain the
 * outcome in plain language — including failure. "Expired" in particular needs
 * to say what to do next, not just that something went wrong.
 */
export default function TokenResultCard({
  endpoint,
  copy,
}: {
  endpoint: string;
  copy: TokenCopy;
}) {
  const [phase, setPhase] = useState<Phase>('working');
  const [reason, setReason] = useState<string>('default');

  useEffect(() => {
    let cancelled = false;
    const token = new URLSearchParams(window.location.search).get('token');

    void (async () => {
      try {
        const res = await fetch(`${endpoint}?token=${encodeURIComponent(token ?? '')}`);
        const body = await res.json();
        if (cancelled) return;
        if (res.ok && body.ok) setPhase('ok');
        else {
          setReason(String(body.reason ?? 'default'));
          setPhase('fail');
        }
      } catch {
        if (!cancelled) {
          setReason('default');
          setPhase('fail');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return (
    <Card sx={{ maxWidth: 520 }}>
      <CardContent>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 4 }}>
          {phase === 'working' && (
            <>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">{copy.working}</Typography>
            </>
          )}

          {phase === 'ok' && (
            <>
              <CheckCircleOutlined sx={{ fontSize: 48, color: 'success.main' }} />
              <Typography variant="h6">{copy.okTitle}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
                {copy.okBody}
              </Typography>
            </>
          )}

          {phase === 'fail' && (
            <>
              <ErrorOutlineOutlined sx={{ fontSize: 48, color: 'error.main' }} />
              <Typography variant="h6">{copy.failTitle}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
                {copy.failBody[reason] ?? copy.failBody.default}
              </Typography>
            </>
          )}

          {phase !== 'working' && (
            <Button component={Link} href="/" variant="outlined" sx={{ mt: 1 }}>
              {copy.homeCta}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
