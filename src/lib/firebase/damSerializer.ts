import 'server-only';
import type { DamDto, DamHistoryPoint } from '@/types/dam';
import { getDam, type DamId } from '@/lib/scrape/damRegistry';

/** Firestore Timestamp-ish shape without importing the admin types here. */
type TimestampLike = { toDate?: () => Date } | null | undefined;

function toIso(ts: TimestampLike): string | null {
  const d = ts?.toDate?.();
  return d ? d.toISOString() : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Converts a `damLatest` document into the wire format.
 *
 * Threshold derivation lives here rather than in the UI so that the Water
 * Level page, the Dam Advisory page and the alert engine cannot drift apart
 * on what "alert level" means.
 */
export function toDamDto(raw: Record<string, unknown>, now = new Date()): DamDto {
  const damId = raw.damId as DamId;
  const meta = getDam(damId);

  const rwl = num(raw.rwl);
  const nhwl = num(raw.nhwl);
  const ruleCurve = num(raw.ruleCurve);
  const gatesOpen = num(raw.gatesOpen);
  const outflowCms = num(raw.outflowCms);

  const observedAt = toIso(raw.observedAt as TimestampLike);
  const ageHours = observedAt
    ? Math.max(0, (now.getTime() - new Date(observedAt).getTime()) / 3_600_000)
    : null;

  return {
    damId,
    damName: (raw.damName as string) ?? meta.name,
    river: meta.river,
    location: meta.location,
    isAgno: meta.isAgno,
    observedAt,
    updatedAt: toIso(raw.updatedAt as TimestampLike),

    rwl,
    rwlDeviation24h: num(raw.rwlDeviation24h),
    nhwl,
    ruleCurve,
    deviationFromNhwl: num(raw.deviationFromNhwl),
    gatesOpen,
    gateOpeningM: num(raw.gateOpeningM),
    inflowCms: num(raw.inflowCms),
    outflowCms,
    trend: (raw.trend as DamDto['trend']) ?? 'STEADY',

    thresholds: {
      normal: ruleCurve,
      alert: nhwl != null ? Number((nhwl - 2).toFixed(2)) : null,
      critical: nhwl,
    },

    percentOfNhwl: rwl != null && nhwl ? Number(((rwl / nhwl) * 100).toFixed(1)) : null,

    // Note the null-safety: `gatesOpen` being null means "not published",
    // which must not be read as "zero gates open, therefore not releasing".
    isReleasing: (gatesOpen ?? 0) > 0 || (outflowCms ?? 0) > 0,

    ageHours: ageHours == null ? null : Number(ageHours.toFixed(1)),
  };
}

export function toHistoryPoint(raw: Record<string, unknown>): DamHistoryPoint {
  return {
    date: raw.date as string,
    rwl: num(raw.rwlClose ?? raw.rwlLast),
    outflowCms: num(raw.outflowClose),
    gatesOpen: num(raw.gatesOpenClose),
  };
}
