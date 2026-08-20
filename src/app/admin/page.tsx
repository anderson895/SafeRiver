'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import PageHeader from '@/components/common/PageHeader';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { SEVERITY_COLORS } from '@/theme/theme';

interface Status {
  admin: { email: string | null; role: string };
  scrape: { ok: boolean | null; ageMinutes: number | null; consecutiveFailures: number; error: string | null };
  rainfall: { ok: boolean | null; ageMinutes: number | null };
  email: { alertsEnabled: boolean; activeSubscribers: number; pendingJobs: number };
  agno: Array<{
    damId: string; damName: string; rwl: number | null; nhwl: number | null;
    outflowCms: number | null; gatesOpen: number | null; isReleasing: boolean;
  }>;
}

const SEVERITIES = ['ADVISORY', 'WATCH', 'WARNING', 'CRITICAL'] as const;

/**
 * Parses an API response, keeping the HTTP status when the body is not JSON.
 *
 * Calling `res.json()` before checking `res.ok` discards the status entirely:
 * a 500 with an empty body — which is how a serverless function reports a
 * crash before it ever ran — surfaced as "Unexpected end of JSON input", a
 * message about parsing that says nothing about the server being down.
 */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();

  let body: Record<string, unknown> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* not JSON — fall through to the status-based message below */
    }
  }

  if (body && res.ok && body.ok !== false) return body;

  if (typeof body?.error === 'string') throw new Error(body.error);
  throw new Error(
    text
      ? `HTTP ${res.status} — server returned a non-JSON response`
      : `HTTP ${res.status} — server returned an empty response (check the deployment logs)`,
  );
}

/** Plain account of what happened to the email, for the officer who pressed send. */
function describeDelivery(notify: boolean, sent: number, stillQueued: boolean): string {
  if (!notify) return 'Advisory published to the site. No email was sent.';
  const people = `${sent} subscriber${sent === 1 ? '' : 's'}`;
  if (sent > 0) {
    return stillQueued
      ? `Advisory published. Sent to ${people}; the rest are still going out.`
      : `Advisory published and emailed to ${people}.`;
  }
  return stillQueued
    ? 'Advisory published, but no email has gone out yet. It is still queued — check the Queue card and system health.'
    : 'Advisory published. No email was sent: no eligible subscribers, or they have hit their daily limit.';
}

export default function AdminPage() {
  const { authedFetch, signOutAdmin, user } = useAdminAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('WARNING');
  const [titleEn, setTitleEn] = useState('');
  const [titleTl, setTitleTl] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyTl, setBodyTl] = useState('');
  const [notify, setNotify] = useState(true);
  const [showTagalog, setShowTagalog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Pure fetch: returns data or throws, and touches no state. Keeping the
  // setState calls at the call sites keeps them out of the effect body.
  const fetchStatus = useCallback(async (): Promise<Status> => {
    const res = await authedFetch('/api/admin/status');
    return (await readJson(res)) as unknown as Status;
  }, [authedFetch]);

  const refresh = useCallback(() => {
    fetchStatus()
      .then((s) => {
        setStatus(s);
        setLoadError(null);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, [fetchStatus]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchStatus();
        if (!cancelled) {
          setStatus(s);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchStatus]);

  /**
   * Prefills from the live dam reading.
   *
   * An officer under pressure should be confirming numbers, not typing them.
   * Retyping a discharge figure at 2 a.m. is exactly where a transcription
   * error gets broadcast to every subscriber.
   */
  function prefillFromDam(damId: string) {
    const dam = status?.agno.find((d) => d.damId === damId);
    if (!dam) return;
    const cms = dam.outflowCms != null ? `${dam.outflowCms} CMS` : 'water';
    const gates = dam.gatesOpen != null ? `${dam.gatesOpen} gate(s) open. ` : '';

    setTitleEn(`Water release at ${dam.damName}`);
    setTitleTl(`Pagpapakawala ng tubig sa ${dam.damName}`);
    setBodyEn(
      `${dam.damName} is releasing ${cms}. ${gates}Reservoir level is ${dam.rwl ?? '—'} masl against a spilling level of ${dam.nhwl ?? '—'} masl. Water levels along the Agno River are expected to rise.`,
    );
    setBodyTl(
      `Nagpapakawala ang ${dam.damName} ng ${cms}. ${gates}Ang lebel ng tubig ay ${dam.rwl ?? '—'} masl samantalang ${dam.nhwl ?? '—'} masl ang lebel ng pag-apaw. Inaasahang tataas ang tubig sa Ilog Agno.`,
    );
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await authedFetch('/api/admin/advisories', {
        method: 'POST',
        body: JSON.stringify({
          severity,
          category: 'DAM_RELEASE',
          // Trimmed so a field holding only spaces is stored as empty. A
          // whitespace-only string is truthy, and would defeat the fallback in
          // pick() — sending a Tagalog reader a blank advisory.
          title: { en: titleEn.trim(), tl: titleTl.trim() },
          body: { en: bodyEn.trim(), tl: bodyTl.trim() },
          actionAdvice: {
            en: 'Move to higher ground if you live near the Agno River. Follow your barangay officials.',
            tl: 'Lumipat sa mataas na lugar kung malapit kayo sa Ilog Agno. Sundin ang inyong barangay officials.',
          },
          affectedBarangays: [],
          notify,
        }),
      });
      const body = await readJson(res);
      // Report what actually reached people, not what was merely accepted.
      // "Queued for email" was true and useless: it read as delivered, while a
      // stalled queue looked identical to a successful send.
      setResult(describeDelivery(notify, Number(body.sent ?? 0), Boolean(body.stillQueued)));
      refresh();
    } catch (err) {
      setResult(`Failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // English alone is enough to publish; pick() serves it to Tagalog readers.
  const canPublish = titleEn.trim() && bodyEn.trim() && !busy;

  return (
    <>
      <PageHeader
        title="DRRM Console"
        subtitle={user?.email ?? undefined}
        action={
          <Button size="small" startIcon={<LogoutOutlined />} onClick={() => void signOutAdmin()}>
            Sign out
          </Button>
        }
      />

      {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}

      {/* Failures here are otherwise silent — from the public site a stopped
          scraper looks exactly like a quiet river. */}
      {status && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            {
              label: 'Dam scrape',
              value: status.scrape.ageMinutes != null ? `${status.scrape.ageMinutes} min ago` : 'never',
              bad: status.scrape.ok === false || (status.scrape.ageMinutes ?? 0) > 120,
              note: status.scrape.error ?? `${status.scrape.consecutiveFailures} consecutive failures`,
            },
            {
              label: 'Rainfall poll',
              value: status.rainfall.ageMinutes != null ? `${status.rainfall.ageMinutes} min ago` : 'never',
              bad: status.rainfall.ok === false || (status.rainfall.ageMinutes ?? 0) > 180,
              note: 'Refreshes hourly',
            },
            {
              label: 'Email delivery',
              value: status.email.alertsEnabled ? 'Enabled' : 'DISABLED',
              bad: !status.email.alertsEnabled,
              note: status.email.alertsEnabled
                ? `${status.email.activeSubscribers} subscribers`
                : 'ALERTS_ENABLED is not true — no email will send',
            },
            {
              label: 'Queue',
              value: `${status.email.pendingJobs} pending`,
              bad: status.email.pendingJobs > 5,
              note: `${status.email.activeSubscribers} active subscribers`,
            },
          ].map((c) => (
            <Grid key={c.label} size={{ xs: 6, md: 3 }}>
              <Card sx={{ height: '100%', borderColor: c.bad ? 'error.main' : undefined }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: c.bad ? 'error.main' : undefined }}>
                    {c.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{c.note}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Post an advisory</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                San Roque announces gate releases on Facebook and in PDFs, which cannot be read
                automatically. Use this to announce a real release as it happens.
              </Typography>

              {status && status.agno.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    Prefill from:
                  </Typography>
                  {status.agno.map((d) => (
                    <Chip
                      key={d.damId}
                      size="small"
                      label={d.damName}
                      onClick={() => prefillFromDam(d.damId)}
                      color={d.isReleasing ? 'error' : 'default'}
                      variant={d.isReleasing ? 'filled' : 'outlined'}
                    />
                  ))}
                </Stack>
              )}

              <Box component="form" onSubmit={publish}>
                <Stack spacing={2}>
                  <TextField
                    select
                    size="small"
                    label="Severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as typeof severity)}
                    sx={{ maxWidth: 220 }}
                  >
                    {SEVERITIES.map((s) => (
                      <MenuItem key={s} value={s}>
                        <Box component="span" sx={{ color: SEVERITY_COLORS[s], fontWeight: 700 }}>{s}</Box>
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField label="Title" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} fullWidth required />
                  <TextField label="Message" value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} fullWidth multiline rows={3} required />

                  {/* Translation is behind a disclosure rather than a second
                      pair of always-visible boxes. Asking for every advisory
                      twice made the common case — one officer, one language,
                      a release happening now — twice the work, and readers set
                      to Tagalog fall back to this English text anyway. */}
                  <Box>
                    <Button
                      size="small"
                      onClick={() => setShowTagalog((v) => !v)}
                      sx={{ textTransform: 'none', px: 0 }}
                    >
                      {/* Prefilling from a dam fills the Tagalog too. Say so on
                          the collapsed control, otherwise text is queued for
                          sending that the officer never saw. */}
                      {showTagalog
                        ? 'Hide Tagalog translation'
                        : titleTl.trim() || bodyTl.trim()
                          ? 'Tagalog translation added — review'
                          : 'Add Tagalog translation (optional)'}
                    </Button>
                    <Collapse in={showTagalog}>
                      <Stack spacing={2} sx={{ mt: 1.5 }}>
                        <TextField
                          label="Pamagat (Tagalog)"
                          value={titleTl}
                          onChange={(e) => setTitleTl(e.target.value)}
                          fullWidth
                        />
                        <TextField
                          label="Mensahe (Tagalog)"
                          value={bodyTl}
                          onChange={(e) => setBodyTl(e.target.value)}
                          fullWidth
                          multiline
                          rows={3}
                        />
                      </Stack>
                    </Collapse>
                  </Box>

                  {/* Unknown is not zero. While status is unloaded the count is
                      simply unavailable, and "0 subscribers" would read as a
                      confirmed empty list — the same falsehood as a missing
                      outflow rendered as 0. */}
                  <FormControlLabel
                    control={<Switch checked={notify} onChange={(e) => setNotify(e.target.checked)} />}
                    label={
                      status
                        ? `Send email to ${status.email.activeSubscribers} subscribers`
                        : 'Send email to subscribers'
                    }
                  />

                  {/* Only assert that delivery is off once that is actually
                      known. Inferring it from an unloaded status states a fact
                      the page has not established, and would tell an officer
                      nothing was sent when it may well have been. */}
                  {notify && status && !status.email.alertsEnabled && (
                    <Alert severity="warning">
                      Email delivery is disabled on this deployment. The advisory will post to the
                      site but nothing will be sent.
                    </Alert>
                  )}

                  {result && (
                    <Alert severity={result.startsWith('Failed') ? 'error' : 'success'}>{result}</Alert>
                  )}

                  <Stack direction="row" spacing={1.5}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={!canPublish}
                      startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SendOutlined />}
                    >
                      {busy ? 'Publishing…' : 'Publish advisory'}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Current readings</Typography>
              {!status ? (
                // A spinner that never resolves reads as "still loading"
                // indefinitely. Once the fetch has failed — most often because
                // the account holds no admin grant — say so rather than
                // animating forever.
                loadError ? (
                  <Typography variant="body2" color="text.secondary">
                    Readings unavailable.
                  </Typography>
                ) : (
                  <CircularProgress size={22} />
                )
              ) : (
                <Stack spacing={1.5}>
                  {status.agno.map((d) => (
                    <Box key={d.damId}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{d.damName}</Typography>
                        <Chip
                          size="small"
                          color={d.isReleasing ? 'error' : 'success'}
                          variant={d.isReleasing ? 'filled' : 'outlined'}
                          label={d.isReleasing ? 'Releasing' : 'Normal'}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {d.rwl ?? '—'} / {d.nhwl ?? '—'} masl
                        {d.outflowCms != null && ` · ${d.outflowCms} CMS`}
                        {d.gatesOpen != null && ` · ${d.gatesOpen} gate(s)`}
                      </Typography>
                      <Divider sx={{ mt: 1.5 }} />
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
