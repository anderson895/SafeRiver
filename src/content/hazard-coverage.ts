/**
 * Which barangays the Project NOAH hazard mapping actually covers.
 *
 * Measured, not assumed: a ~130 m grid was sampled inside each barangay
 * polygon and tested against the 100-year hazard layer. Reproduce with the
 * coverage check in scripts/gis/ after any rebuild of the layers.
 *
 *   San Roque    2086 points    0%     <- the barangay containing the dam
 *   Lapalo       1987 points    3%
 *   Narra         559 points    1%
 *   ...the remaining eleven range from 27% to 84%
 *
 * WHY THIS MATTERS
 * These three are the largest barangays, together roughly two-thirds of San
 * Manuel by area. On a map, "no colour" is read as "no danger". For a resident
 * of San Roque or Lapalo that reading is wrong and potentially fatal: their
 * barangay was never surveyed, not found safe.
 *
 * So the map states it explicitly and marks these barangays as unmapped rather
 * than leaving them blank alongside genuinely low-hazard areas.
 */
export const UNMAPPED_BARANGAYS = ['San Roque', 'Lapalo', 'Narra'] as const;

/**
 * Native cell size of the hazard data, in metres.
 *
 * Measured from the delivered geometry, not taken from the dataset
 * description: 97.5% of all 35,322 polygon segments are exactly 30.0 m long.
 * The layers are a vectorised 30 m raster.
 *
 * Two consequences worth stating plainly:
 *
 *  - The stair-stepped edges visible when zoomed in are the real shape of the
 *    data, not a rendering fault. Smoothing them would imply a precision the
 *    survey does not have, which on a hazard map is a lie with consequences.
 *  - Below roughly this scale the map cannot distinguish one property from its
 *    neighbour. It answers "is this area at risk", not "is this house at risk".
 *
 * Note that the upstream dataset description credits 1 m LiDAR/IfSAR DEMs.
 * Whatever the modelling input, the published product is 30 m — worth citing
 * accurately rather than repeating the source's own framing.
 */
export const HAZARD_CELL_SIZE_M = 30;

/** Percentage of each barangay covered by the 100-year hazard layer. */
export const COVERAGE_PERCENT: Record<string, number> = {
  'Guiset Sur': 84,
  Cabaritan: 67,
  Cabacaraan: 54,
  Nagsaag: 54,
  'San Juan': 54,
  'San Antonio-Arzadon': 51,
  'Santo Domingo': 47,
  Flores: 40,
  'Guiset Norte': 35,
  'San Bonifacio': 32,
  'San Vicente': 27,
  Lapalo: 3,
  Narra: 1,
  'San Roque': 0,
};
