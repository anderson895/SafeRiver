'use client';

import { useCallback, useMemo, useState } from 'react';
import Map, { Layer, Source, Popup, NavigationControl, ScaleControl, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { setWorkerUrl, type FillLayerSpecification, type LineLayerSpecification } from 'maplibre-gl';
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
const notMappedFill: FillLayerSpecification = {
  id: 'not-mapped-fill',
  type: 'fill',
  source: 'barangays',
  filter: ['in', ['get', 'barangay'], ['literal', [...UNMAPPED_BARANGAYS]]],
  paint: { 'fill-color': '#9E9E9E', 'fill-opacity': 0.28 },
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
