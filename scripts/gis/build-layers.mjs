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

// San Manuel bbox (120.6112,16.0422 -> 120.7245,16.2046) padded ~2 km so the
// hazard layer does not stop abruptly at the municipal line.
const CLIP_BBOX = '120.59,16.02,120.75,16.23';

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
    await runCommands(
      [
        `-i "${src}"`,
        `-clip bbox=${CLIP_BBOX}`,
        '-dissolve2 Var',
        '-simplify visvalingam 8% keep-shapes',
        '-filter-slivers min-area=200m2',
        '-clean',
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

  await runCommands(
    `-i "${tmp}" -simplify visvalingam 45% keep-shapes -clean -o precision=0.000001 "${OUT_DIR}/barangays.geojson"`,
  );
  console.log(`  barangays.geojson  ${mb(`${OUT_DIR}/barangays.geojson`)}  (${features.length} barangays)`);

  // Dissolve the barangays into a single municipal outline for the map border.
  // Dissolving on a constant field (rather than bare -dissolve2) keeps one
  // attribute alive, so mapshaper emits a FeatureCollection instead of a bare
  // GeometryCollection — which is what MapLibre's GeoJSON source expects.
  await runCommands(
    [
      `-i "${tmp}"`,
      '-each \'municipality="San Manuel", province="Pangasinan"\'',
      '-dissolve2 municipality copy-fields=province',
      '-simplify visvalingam 45% keep-shapes',
      '-clean',
      `-o precision=0.000001 "${OUT_DIR}/sanmanuel-boundary.geojson"`,
    ].join(' '),
  );
  console.log(`  sanmanuel-boundary.geojson  ${mb(`${OUT_DIR}/sanmanuel-boundary.geojson`)}`);

  return features.map((f) => f.properties.barangay);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('Building San Manuel hazard + admin layers...\n');

  const barangays = await buildAdminLayers();
  await buildFloodLayers();

  console.log(`\nBarangays: ${barangays.join(', ')}`);
  console.log('\nDone. Attribution required — see ATTRIBUTION.md (Project NOAH, ODbL).');
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
