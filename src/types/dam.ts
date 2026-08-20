import type { DamId } from '@/lib/scrape/damRegistry';

/** Wire format for dam data. Timestamps are ISO strings, not Firestore types. */
export interface DamDto {
  damId: DamId;
  damName: string;
  river: string;
  location: string;
  isAgno: boolean;
  observedAt: string | null;
  updatedAt: string | null;

  rwl: number | null;
  rwlDeviation24h: number | null;
  nhwl: number | null;
  ruleCurve: number | null;
  deviationFromNhwl: number | null;
  gatesOpen: number | null;
  gateOpeningM: number | null;
  inflowCms: number | null;
  outflowCms: number | null;
  trend: 'RISING' | 'FALLING' | 'STEADY';

  /**
   * Derived threshold triad shown on the Water Level page.
   *
   * The reference mockup showed a river gauge with Normal/Alert/Critical
   * levels, but no free public source publishes river stage on the Agno at
   * San Manuel. These are derived from fields PAGASA actually publishes, so
   * every number on screen traces to an official bulletin:
   *   normal   = Rule Curve Elevation (seasonal operating target)
   *   alert    = NHWL - 2 m
   *   critical = NHWL (the spilling level; 280 masl for San Roque)
   */
  thresholds: {
    normal: number | null;
    alert: number | null;
    critical: number | null;
  };

  /** How full the reservoir is relative to its spilling level, as a percentage. */
  percentOfNhwl: number | null;
  /** True when gates are open or a positive outflow is reported. */
  isReleasing: boolean;
  /** Hours since the observation; drives the stale-data notice. */
  ageHours: number | null;
}

export interface DamHistoryPoint {
  date: string;
  rwl: number | null;
  outflowCms: number | null;
  gatesOpen: number | null;
}
