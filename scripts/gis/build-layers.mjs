/**
 * Builds every static geospatial asset the app serves, from the raw public
 * downloads. Reproducible from scratch — this script is itself a thesis
 * deliverable (methodology chapter, "data preparation").
 *
 *   node scripts/gis/build-layers.mjs
 *
 * Inputs (see scripts/gis/fetch-sources.sh):
 *   data/raw/Pangasinan_{5yr,25yr,100yr}.zip   Project NOAH flood hazard (ODbL)
 *   data/raw/gadm41_PHL_3.json.zip             GADM v4.1 admin boundaries
 *
 * Outputs (committed, served from /public):
 *   public/geo/flood-{5,25,100}yr.geojson      hazard polygons, Var 1|2|3
 *   public/geo/barangays.geojson               14 San Manuel barangays
 *   public/geo/sanmanuel-boundary.geojson      dissolved municipal outline
 *
 * NOTE ON FORMAT: the finished layers total well under 2 MB, so they are served
 * as plain GeoJSON and tiled client-side by MapLibre (geojson-vt). Vector tiles
 * (tippecanoe/PMTiles) were evaluated and rejected as unnecessary complexity at
 * this data volume — see README "Why not PMTiles".
 */
// mapshaper ships as CommonJS, so it must be default-imported here.
import mapshaper from 'mapshaper';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';

const { runCommands } = mapshaper;

const PROVINCE = 'Pangasinan';
const MUNICIPALITY = 'SanManuel'; // GADM spells municipality names without spaces
const RETURN_PERIODS = ['5yr', '25yr', '100yr'];

/**
 * Fast pre-filter only. Cuts the province-wide shapefile down before the real
 * clip, which is what makes the polygon clip affordable on a 168 MB input.
 *
 * This must NOT be the final extent. A bbox produces dead-straight edges that
 * read as hazard boundaries but are really just the edge of the box, and it
 * spills 2-3 km into Binalonan, Laoac and Asingan — municipalities outside the
 * study area. The authoritative clip is the municipal boundary below.
 */
const PREFILTER_BBOX = '120.59,16.02,120.75,16.23';

const OUT_DIR = 'public/geo';

/** GADM stores "GuisetNorte" / "SanAntonio-Arzadon"; restore the spaces. */
function prettifyName(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/-([A-Z])/g, '-$1')
    .trim();
}

function mb(path) {
  const kb = statSync(path).size / 1024;
  return kb < 10 ? `${kb.toFixed(1)} KB` : `${kb.toFixed(0)} KB`;
}

async function buildFloodLayers() {
  for (const rp of RETURN_PERIODS) {
    const src = `data/interim/${rp}/${PROVINCE}/PH015500000_FH_${rp}.shp`;
    if (!existsSync(src)) {
      throw new Error(`Missing ${src} — run scripts/gis/fetch-sources.sh first`);
    }
    const dest = `${OUT_DIR}/flood-${rp}.geojson`;

    // -dissolve2 (merging adjacent same-class polygons) does more for file size
    // than simplification alone. keep-shapes stops small hazard islands from
    // being simplified out of existence.
    //
    // ORDER MATTERS. The boundary clip must be the LAST spatial operation.
    //
    // Clipping before simplification does not hold: -simplify straightens
    // curves, so wherever the municipal boundary is concave the straightened
    // hazard edge cuts across it and bulges back outside. Measured on the
    // 100-year layer, that put 93 vertices outside the municipality, the worst
    // of them 3.5 km out — well past a rounding artifact.
    //
    // The bbox stays only as a cheap pre-filter, to make the polygon clip
    // affordable against a 168 MB input.
    await runCommands(
      [
        `-i "${src}"`,
        `-clip bbox=${PREFILTER_BBOX}`,
        '-dissolve2 Var',
        '-simplify visvalingam 8% keep-shapes',
        '-filter-slivers min-area=200m2',
        '-clean',
        `-clip "${OUT_DIR}/sanmanuel-boundary.geojson"`,
        `-o precision=0.000001 "${dest}"`,
      ].join(' '),
    );
    console.log(`  flood-${rp}.geojson  ${mb(dest)}`);
  }
}

async function buildAdminLayers() {
  const gadmPath = 'data/interim/gadm/gadm41_PHL_3.json';
  if (!existsSync(gadmPath)) {
    throw new Error(`Missing ${gadmPath} — run scripts/gis/fetch-sources.sh first`);
  }

  const gadm = JSON.parse(readFileSync(gadmPath, 'utf8'));
  const features = gadm.features
    .filter((f) => f.properties.NAME_1 === PROVINCE && f.properties.NAME_2 === MUNICIPALITY)
    .map((f) => ({
      type: 'Feature',
      properties: {
        barangay: prettifyName(f.properties.NAME_3),
        municipality: 'San Manuel',
        province: 'Pangasinan',
        gid: f.properties.GID_3,
      },
      geometry: f.geometry,
    }))
    .sort((a, b) => a.properties.barangay.localeCompare(b.properties.barangay));

  if (features.length === 0) {
    throw new Error(`No barangays found for ${MUNICIPALITY}, ${PROVINCE} in GADM`);
  }

  const tmp = 'data/interim/sanmanuel_barangays_raw.geojson';
  writeFileSync(tmp, JSON.stringify({ type: 'FeatureCollection', features }));

  // NOT simplified.
  //
  // GADM level-3 is already a generalised product — its San Manuel outline is
  // 119 km2 against an official 129.18 km2 — and simplifying further makes a
  // bad fit worse. At 45% the municipal outline collapsed to 33 vertices, and
  // clipping 1-metre LiDAR hazard data against an outline that coarse does not
  // just look wrong: it erases real hazard inside the municipality, which is
  // the one error this system must never make.
  //
  // These files are a few KB either way, so there is nothing to gain.
  await runCommands(
    `-i "${tmp}" -clean -o precision=0.000001 "${OUT_DIR}/barangays.geojson"`,
  );
  console.log(`  barangays.geojson  ${mb(`${OUT_DIR}/barangays.geojson`)}  (${features.length} barangays)`);

  // Dissolve the ALREADY-SIMPLIFIED barangays, with no further simplification.
  //
  // Simplifying the barangays and the outline independently seems harmless but
  // is not: the two passes make different vertex choices, so edges that were
  // shared drift apart. Measured before this fix, 23% of barangay vertices fell
  // outside the outline they were dissolved from — and the flood layers,
  // clipped against that outline, inherited the same disagreement.
  //
  // Dissolving the simplified input makes the outline exactly the union of the
  // barangays by construction.
  //
  // Dissolving on a constant field (rather than bare -dissolve2) keeps one
  // attribute alive, so mapshaper emits a FeatureCollection instead of a bare
  // GeometryCollection — which is what MapLibre's GeoJSON source expects.
  // gap-fill-area closes the hairline gaps GADM leaves between adjacent
  // barangay polygons. Without it the dissolve leaves five sliver "holes"
  // of 0.01-0.14 km2 punched through the middle of the municipality. They are
  // topology noise, not enclaves — San Manuel has none — but hazard clipped
  // against that outline gets punched through in the same places.
  await runCommands(
    [
      `-i "${OUT_DIR}/barangays.geojson"`,
      '-each \'municipality="San Manuel", province="Pangasinan"\'',
      '-clean gap-fill-area=500000m2',
      '-dissolve2 municipality copy-fields=province',
      `-o precision=0.000001 "${OUT_DIR}/sanmanuel-boundary.geojson"`,
    ].join(' '),
  );
  console.log(`  sanmanuel-boundary.geojson  ${mb(`${OUT_DIR}/sanmanuel-boundary.geojson`)}`);

  return features.map((f) => f.properties.barangay);
}

/** Ray-casting point-in-polygon over one linear ring. */
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Metres from a point to the nearest segment of a ring. */
function metresToRing(pt, ring) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / (dx * dx + dy * dy || 1e-12)));
    const mx = (pt[0] - (x1 + t * dx)) * 111320 * Math.cos((pt[1] * Math.PI) / 180);
    const my = (pt[1] - (y1 + t * dy)) * 110540;
    best = Math.min(best, Math.hypot(mx, my));
  }
  return best;
}

/**
 * Asserts every hazard vertex lies inside the municipality.
 *
 * This exists because the failure it catches is invisible: a hazard polygon
 * spilling into a neighbouring town still renders as a perfectly plausible
 * map. It was only noticed by eye, and only after it shipped.
 *
 * Vertices sitting exactly on the boundary are expected — that is what a clip
 * produces — so anything within TOLERANCE_M counts as contained.
 */
/**
 * A clip inserts vertices where geometry meets the cut line, and those land on
 * the boundary rather than strictly inside it. Floating-point rounding and the
 * `precision=` output step nudge them by centimetres. Anything within this
 * distance of the boundary is therefore contained; the check exists to catch
 * geometry escaping by kilometres, which is what a wrong clip actually looks
 * like.
 */
const TOLERANCE_M = 25;

function verifyContainment() {
  const boundary = JSON.parse(readFileSync(`${OUT_DIR}/sanmanuel-boundary.geojson`, 'utf8'))
    .features[0].geometry;
  const rings = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates;

  let failed = false;

  for (const rp of RETURN_PERIODS) {
    const gj = JSON.parse(readFileSync(`${OUT_DIR}/flood-${rp}.geojson`, 'utf8'));
    const pts = [];
    const walk = (a) => (typeof a[0] === 'number' ? pts.push(a) : a.forEach(walk));
    gj.features.forEach((f) => walk(f.geometry.coordinates));

    let worst = 0;
    let outside = 0;
    for (const p of pts) {
      const contained = rings.some(
        (poly) => inRing(p, poly[0]) && !poly.slice(1).some((h) => inRing(p, h)),
      );
      if (contained) continue;
      const d = Math.min(...rings.map((poly) => metresToRing(p, poly[0])));
      if (d > TOLERANCE_M) {
        outside += 1;
        worst = Math.max(worst, d);
      }
    }

    if (outside > 0) {
      console.error(
        `  FAIL flood-${rp}: ${outside} vertices outside the municipality (worst ${worst.toFixed(0)} m)`,
      );
      failed = true;
    } else {
      console.log(`  flood-${rp.padEnd(5)} contained (${pts.length} vertices checked)`);
    }
  }

  if (failed) {
    throw new Error('Hazard layers escape the municipal boundary — check the clip ordering');
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('Building San Manuel hazard + admin layers...\n');

  const barangays = await buildAdminLayers();
  await buildFloodLayers();

  console.log('\nVerifying containment...');
  verifyContainment();

  console.log(`\nBarangays: ${barangays.join(', ')}`);
  console.log('\nDone. Attribution required — see ATTRIBUTION.md (Project NOAH, ODbL).');
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
