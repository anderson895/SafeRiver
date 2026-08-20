'use client';

import { useSyncExternalStore } from 'react';
import Typography from '@mui/material/Typography';

/**
 * Philippine-time clock in the app bar.
 *
 * Uses useSyncExternalStore rather than useState + useEffect. A clock is an
 * external, mutable source whose value legitimately differs between the server
 * render and the client, and this hook models exactly that: `getServerSnapshot`
 * returns null so the server (and the hydrating pass) render nothing, which
 * avoids a hydration mismatch without a setState-in-effect workaround.
 */

const TICK_MS = 30_000;

// getSnapshot must return a referentially stable value between renders, or
// React re-renders forever. Bucketing by tick gives a value that only changes
// once per interval.
let cachedBucket = -1;
let cachedDate: Date | null = null;

function getSnapshot(): Date | null {
  const bucket = Math.floor(Date.now() / TICK_MS);
  if (bucket !== cachedBucket) {
    cachedBucket = bucket;
    cachedDate = new Date();
  }
  return cachedDate;
}

function getServerSnapshot(): Date | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

const FORMATTER = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export default function LiveClock() {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <Typography
      variant="body2"
      color="text.secondary"
      // Space is reserved even while empty so the app bar does not shift
      // when the clock appears after hydration.
      sx={{ minWidth: 150, textAlign: 'right', display: { xs: 'none', sm: 'block' } }}
    >
      {now ? FORMATTER.format(now) : ''}
    </Typography>
  );
}
