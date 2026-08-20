'use client';

import { useCallback, useMemo, useState } from 'react';
import Map, { Layer, Source, Popup, NavigationControl, ScaleControl, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { setWorkerUrl, type FillLayerSpecification, type LineLayerSpecification, type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { HAZARD_COLORS, HAZARD_LABELS } from '@/theme/theme';
import { UNMAPPED_BARANGAYS } from '@/content/hazard-coverage';

/**
 * Point MapLibre at the worker we serve from /public (synced by
 * scripts/copy-maplibre-worker.mjs). Turbopack cannot resolve maplibre's own
 * `new Worker(url, {type:'module'})` call, so without this the worker request
 * returns the app's HTML shell and the map canvas renders blank.
 *
 * Must run at module scope — before any Map is constructed.
 */
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export type ReturnPeriod = '5yr' | '25yr' | '100yr';

/** San Manuel, Pangasinan town centre. */
export const SAN_MANUEL_CENTER = { longitude: 120.6647, latitude: 16.0708 } as const;

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron';

/**
 * Source and layer IDs are CONSTANT across return periods.
 *
 * They must not be derived from `returnPeriod`. react-map-gl treats a changed
 * `id` on a mounted <Source> as a fatal "source id changed" error rather than
 * a swap. Switching 5yr/25yr/100yr therefore only changes the `data` URL, and
 * MapLibre reloads the GeoJSON in place.
 */
const HAZARD_SOURCE_ID = 'flood-hazard';
const HAZARD_FILL_ID = 'flood-hazard-fill';
const BARANGAY_FILL_ID = 'barangay-fill';

/**
 * Colour ramp driven by the Project NOAH `Var` attribute (1=Low, 2=Med, 3=High).
 * Using a data-driven `match` expression means one layer renders all three
 * classes, instead of three separate filtered layers.
 */
const hazardFill: FillLayerSpecification = {
  id: HAZARD_FILL_ID,
  type: 'fill',
  source: HAZARD_SOURCE_ID,
  paint: {
    'fill-color': [
      'match',
      ['get', 'Var'],
      1, HAZARD_COLORS[1],
      2, HAZARD_COLORS[2],
      3, HAZARD_COLORS[3],
      '#CCCCCC',
    ],
    'fill-opacity': 0.55,
  },
};

const boundaryLine: LineLayerSpecification = {
  id: 'boundary-line',
  type: 'line',
  source: 'boundary',
  paint: { 'line-color': '#1565C0', 'line-width': 2.5, 'line-dasharray': [3, 2] },
};

const barangayLine: LineLayerSpecification = {
  id: 'barangay-line',
  type: 'line',
  source: 'barangays',
  paint: { 'line-color': '#546E7A', 'line-width': 0.8, 'line-opacity': 0.7 },
};

/**
 * Barangays the hazard survey never covered.
 *
 * Rendered as a distinct grey fill rather than left blank. Blank is read as
 * "no danger", and for San Roque, Lapalo and Narra — about two-thirds of the
 * municipality, including the barangay containing the dam — that reading is
 * wrong. They were not surveyed, not found safe.
 */
/** Pattern id registered on the map at load time. */
const HATCH_IMAGE_ID = 'not-mapped-hatch';

/**
 * Diagonal hatch marking "no data".
 *
 * A flat grey fill was tried first and did not work: the basemap already
 * shades terrain and the reservoir in grey up north, so two different greys
 * sat side by side meaning different things, and a reader could not tell
 * "unsurveyed" from "hillside". Hatching is the cartographic convention for
 * absent data precisely because it cannot be mistaken for a landcover tint.
 */
function makeHatchImage(size = 16): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(120,120,120,0.14)';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(70,70,70,0.55)';
  ctx.lineWidth = 1.6;
  // Draw twice, offset, so the stripes tile seamlessly across tile edges.
  for (let i = -size; i < size * 2; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }

  return ctx.getImageData(0, 0, size, size);
}

const notMappedFill: FillLayerSpecification = {
  id: 'not-mapped-fill',
  type: 'fill',
  source: 'barangays',
  filter: ['in', ['get', 'barangay'], ['literal', [...UNMAPPED_BARANGAYS]]],
  paint: { 'fill-pattern': HATCH_IMAGE_ID },
};

const notMappedLine: LineLayerSpecification = {
  id: 'not-mapped-line',
  type: 'line',
  source: 'barangays',
  filter: ['in', ['get', 'barangay'], ['literal', [...UNMAPPED_BARANGAYS]]],
  paint: { 'line-color': '#616161', 'line-width': 1.2, 'line-dasharray': [2, 2] },
};

interface PopupInfo {
  longitude: number;
  latitude: number;
  hazard: 1 | 2 | 3 | null;
  barangay: string | null;
}

export interface HazardMapProps {
  returnPeriod?: ReturnPeriod;
  showBarangays?: boolean;
  height?: number | string;
}

export default function HazardMap({
  returnPeriod = '100yr',
  showBarangays = true,
  height = 520,
}: HazardMapProps) {
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  const interactiveLayerIds = useMemo(
    () => (showBarangays ? [HAZARD_FILL_ID, BARANGAY_FILL_ID] : [HAZARD_FILL_ID]),
    [showBarangays],
  );

  // The hatch must exist before the layer that references it paints, so it is
  // registered on load rather than in an effect.
  const onLoad = useCallback((e: { target: MapLibreMap }) => {
    const map = e.target;
    if (!map.hasImage(HATCH_IMAGE_ID)) {
      map.addImage(HATCH_IMAGE_ID, makeHatchImage(), { pixelRatio: 2 });
    }
  }, []);

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const features = e.features ?? [];
    const hazardFeature = features.find((f) => f.layer?.id === HAZARD_FILL_ID);
    const barangayFeature = features.find((f) => f.source === 'barangays');

    if (!hazardFeature && !barangayFeature) {
      setPopup(null);
      return;
    }

    setPopup({
      longitude: e.lngLat.lng,
      latitude: e.lngLat.lat,
      hazard: (hazardFeature?.properties?.Var as 1 | 2 | 3 | undefined) ?? null,
      barangay: (barangayFeature?.properties?.barangay as string | undefined) ?? null,
    });
  }, []);

  return (
    <div style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <Map
        initialViewState={{ ...SAN_MANUEL_CENTER, zoom: 11.2 }}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={interactiveLayerIds}
        onClick={onClick}
        onLoad={onLoad}
      >
        <NavigationControl position="top-left" />
        <ScaleControl position="bottom-left" />

        {/* Stable id; only `data` changes when the return period is switched. */}
        <Source id={HAZARD_SOURCE_ID} type="geojson" data={`/geo/flood-${returnPeriod}.geojson`}>
          <Layer {...hazardFill} />
        </Source>

        {showBarangays && (
          <Source id="barangays" type="geojson" data="/geo/barangays.geojson">
            {/* Invisible fill purely to give barangays a click target. */}
            <Layer
              id={BARANGAY_FILL_ID}
              type="fill"
              source="barangays"
              paint={{ 'fill-color': '#000000', 'fill-opacity': 0 }}
            />
            <Layer {...notMappedFill} />
            <Layer {...notMappedLine} />
            <Layer {...barangayLine} />
          </Source>
        )}

        <Source id="boundary" type="geojson" data="/geo/sanmanuel-boundary.geojson">
          <Layer {...boundaryLine} />
        </Source>

        {popup && (
          <Popup
            longitude={popup.longitude}
            latitude={popup.latitude}
            anchor="bottom"
            onClose={() => setPopup(null)}
            closeOnClick={false}
          >
            <div style={{ font: '13px/1.5 system-ui', minWidth: 160 }}>
              {popup.barangay && (
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Brgy. {popup.barangay}</div>
              )}
              {popup.hazard ? (
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: HAZARD_COLORS[popup.hazard],
                      marginRight: 6,
                    }}
                  />
                  {HAZARD_LABELS[popup.hazard].en}
                </div>
              ) : popup.barangay && (UNMAPPED_BARANGAYS as readonly string[]).includes(popup.barangay) ? (
                // Distinguishing these two cases is the whole point: one means
                // surveyed and low, the other means never surveyed.
                <div style={{ color: '#B26A00', fontWeight: 600 }}>
                  Not surveyed — no hazard mapping exists for this barangay
                </div>
              ) : (
                <div style={{ color: '#666' }}>No mapped flood hazard here</div>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
