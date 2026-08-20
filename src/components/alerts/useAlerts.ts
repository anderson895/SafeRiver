'use client';

import { useEffect, useState } from 'react';
import type { AlertItem } from './AlertCard';

interface Settled {
  url: string | null;
  alerts: AlertItem[];
  activeCount: number;
  error: string | null;
}

/**
 * Fetches recent alerts.
 *
 * Loading is derived from whether the settled url matches the requested one,
 * keeping the effect free of synchronous state updates.
 */
export function useAlerts(limit = 20) {
  const url = `/api/alerts?limit=${limit}`;
  const [settled, setSettled] = useState<Settled>({
    url: null,
    alerts: [],
    activeCount: 0,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(url);
        const body = await res.json();
        if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (!cancelled) {
          setSettled({
            url,
            alerts: body.alerts as AlertItem[],
            activeCount: body.activeCount as number,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setSettled({ url, alerts: [], activeCount: 0, error: (err as Error).message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return {
    alerts: settled.url === url ? settled.alerts : [],
    activeCount: settled.url === url ? settled.activeCount : 0,
    loading: settled.url !== url,
    error: settled.url === url ? settled.error : null,
  };
}
