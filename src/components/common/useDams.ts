'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DamDto, DamHistoryPoint } from '@/types/dam';

/**
 * Minimal JSON fetch hook.
 *
 * `loading` is DERIVED by comparing the requested url against the url of the
 * last settled response, rather than being flipped with a setState at the top
 * of the effect. That keeps the effect free of synchronous state updates (the
 * react-hooks/set-state-in-effect rule) and, more usefully, makes "loading"
 * automatically true the instant the url changes — no intermediate render
 * where a new selection is shown alongside the previous dam's data.
 */
interface Settled<T> {
  /** The url this snapshot corresponds to; null before anything has settled. */
  url: string | null;
  data: T | null;
  error: string | null;
}

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function useJson<T>(url: string | null): FetchState<T> {
  const [settled, setSettled] = useState<Settled<T>>({ url: null, data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(url);
        const body = await res.json();
        if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (!cancelled) setSettled({ url, data: body as T, error: null });
      } catch (err) {
        if (!cancelled) {
          setSettled({ url, data: null, error: (err as Error).message });
        }
      }
    })();

    // Guards against a slow response for a previously selected dam landing
    // after the user has already switched to another one.
    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const reload = useCallback(() => {
    // Clearing the settled url flips `loading` back on for the retry.
    setSettled({ url: null, data: null, error: null });
    setNonce((n) => n + 1);
  }, []);

  return {
    data: settled.url === url ? settled.data : null,
    loading: url != null && settled.url !== url,
    error: settled.url === url ? settled.error : null,
    reload,
  };
}

export function useDams() {
  const { data, loading, error, reload } = useJson<{ dams: DamDto[]; agno: DamDto[] }>('/api/dams');
  return { dams: data?.dams ?? [], agno: data?.agno ?? [], loading, error, reload };
}

export function useDamHistory(damId: string | null, days = 30) {
  const { data, loading, error } = useJson<{ points: DamHistoryPoint[] }>(
    damId ? `/api/dams/${damId}/history?days=${days}` : null,
  );
  return { points: data?.points ?? [], loading, error };
}
