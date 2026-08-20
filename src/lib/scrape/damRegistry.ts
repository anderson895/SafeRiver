/**
 * The dams PAGASA publishes, and which ones matter for San Manuel.
 *
 * The Agno River cascade is Ambuklao -> Binga -> San Roque. San Roque Dam is
 * physically located in San Manuel, Pangasinan, so its releases are the direct
 * flood driver for the study area; Ambuklao and Binga are upstream in Benguet
 * and act as leading indicators.
 */
export type DamId =
  | 'san-roque'
  | 'binga'
  | 'ambuklao'
  | 'angat'
  | 'ipo'
  | 'la-mesa'
  | 'pantabangan'
  | 'magat'
  | 'caliraya';

export interface DamMeta {
  id: DamId;
  /** Display name used in the UI. */
  name: string;
  /** Matches the "Dam Name" cell. PAGASA is inconsistent ("San Roque" vs "Magat Dam"). */
  pattern: RegExp;
  /** True for the Agno cascade — these drive alerts for San Manuel. */
  isAgno: boolean;
  /** Position in the cascade; lower flows into higher. */
  cascadeOrder?: number;
  river: string;
  location: string;
  /** Published spilling level (masl). Verified against the PAGASA bulletin. */
  nhwl?: number;
}

export const DAM_REGISTRY: DamMeta[] = [
  {
    id: 'san-roque',
    name: 'San Roque Dam',
    pattern: /san\s*roque/i,
    isAgno: true,
    cascadeOrder: 3,
    river: 'Agno River',
    location: 'San Manuel, Pangasinan',
    nhwl: 280,
  },
  {
    id: 'binga',
    name: 'Binga Dam',
    pattern: /^binga/i,
    isAgno: true,
    cascadeOrder: 2,
    river: 'Agno River',
    location: 'Itogon, Benguet',
    nhwl: 575,
  },
  {
    id: 'ambuklao',
    name: 'Ambuklao Dam',
    pattern: /ambuklao/i,
    isAgno: true,
    cascadeOrder: 1,
    river: 'Agno River',
    location: 'Bokod, Benguet',
    nhwl: 752,
  },
  { id: 'angat', name: 'Angat Dam', pattern: /angat/i, isAgno: false, river: 'Angat River', location: 'Norzagaray, Bulacan' },
  { id: 'ipo', name: 'Ipo Dam', pattern: /^ipo/i, isAgno: false, river: 'Angat River', location: 'Norzagaray, Bulacan' },
  { id: 'la-mesa', name: 'La Mesa Dam', pattern: /la\s*mesa/i, isAgno: false, river: 'Tullahan River', location: 'Quezon City' },
  { id: 'pantabangan', name: 'Pantabangan Dam', pattern: /pantabangan/i, isAgno: false, river: 'Pampanga River', location: 'Nueva Ecija' },
  { id: 'magat', name: 'Magat Dam', pattern: /magat/i, isAgno: false, river: 'Cagayan River', location: 'Isabela' },
  { id: 'caliraya', name: 'Caliraya Dam', pattern: /caliraya/i, isAgno: false, river: 'Caliraya River', location: 'Laguna' },
];

/** Dams that drive San Manuel alerting, ordered upstream -> downstream. */
export const AGNO_DAM_IDS: DamId[] = ['ambuklao', 'binga', 'san-roque'];

export function matchDam(damNameCell: string): DamMeta | null {
  const cleaned = damNameCell.trim();
  if (!cleaned) return null;
  return DAM_REGISTRY.find((d) => d.pattern.test(cleaned)) ?? null;
}

export function getDam(id: DamId): DamMeta {
  const dam = DAM_REGISTRY.find((d) => d.id === id);
  if (!dam) throw new Error(`Unknown dam id: ${id}`);
  return dam;
}
