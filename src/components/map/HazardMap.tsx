'use client';

import { useCallback, useMemo, useState } from 'react';
import Map, { Layer, Source, Popup, NavigationControl, ScaleControl, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { setWorkerUrl, type FillLayerSpecification, type LineLayerSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { HAZARD_COLORS, HAZARD_LABELS } from '@/theme/theme';

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
 * Colour ramp driven by the Project NOAH `Var` attribute (1=Low, 2=Med, 3=High).
 * Using a data-driven `match` expression means one layer renders all three
 * classes, instead of three separate filtered layers.
 */
const hazardFill = (id: string): FillLayerSpecification => ({
  id,
  type: 'fill',
  source: id,
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
});

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

  const hazardLayerId = useMemo(() => `flood-${returnPeriod}`, [returnPeriod]);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const features = e.features ?? [];
      const hazardFeature = features.find((f) => f.layer?.id === hazardLayerId);
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
    },
    [hazardLayerId],
  );

  return (
    <div style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <Map
        initialViewState={{ ...SAN_MANUEL_CENTER, zoom: 11.2 }}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={showBarangays ? [hazardLayerId, 'barangay-fill'] : [hazardLayerId]}
        onClick={onClick}
      >
        <NavigationControl position="top-left" />
        <ScaleControl position="bottom-left" />

        <Source id={hazardLayerId} type="geojson" data={`/geo/flood-${returnPeriod}.geojson`}>
          <Layer {...hazardFill(hazardLayerId)} />
        </Source>

        {showBarangays && (
          <Source id="barangays" type="geojson" data="/geo/barangays.geojson">
            {/* Invisible fill purely to give barangays a click target. */}
            <Layer
              id="barangay-fill"
              type="fill"
              source="barangays"
              paint={{ 'fill-color': '#000000', 'fill-opacity': 0 }}
            />
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
