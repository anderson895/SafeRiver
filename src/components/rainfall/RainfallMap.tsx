'use client';

import { useMemo, useState } from 'react';
import Map, { Layer, Source, NavigationControl, ScaleControl } from 'react-map-gl/maplibre';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SAN_MANUEL_CENTER } from '@/components/map/HazardMap';

// Turbopack cannot resolve maplibre's module-worker URL, so point it at the
// copy served from /public. See scripts/copy-maplibre-worker.mjs.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron';

export interface RadarData {
  host: string;
  frames: Array<{ time: number; path: string }>;
}

/**
 * Highest zoom RainViewer actually serves radar for.
 *
 * Above this it returns a "Zoom Level Not Supported" placeholder image rather
 * than an HTTP error, so the failure is visual rather than something the map
 * library can detect. Probed directly: z6 and z7 return real imagery (23 KB and
 * 10 KB), while z8, z9 and z10 all return an identical 1370-byte placeholder.
 *
 * Declaring maxzoom lets MapLibre overzoom — it stretches the z7 tile instead
 * of requesting a level that does not exist.
 */
const RADAR_MAX_ZOOM = 7;

/** RainViewer's "universal blue" scheme, smoothed, no snow layer. */
function tileUrl(host: string, path: string): string {
  return `${host}${path}/256/{z}/{x}/{y}/2/1_0.png`;
}

/**
 * Rain radar over San Manuel.
 *
 * Radar tiles are plain raster images, so they load without CORS; only the
 * frame index needs a server-side proxy (see /api/rainfall).
 *
 * Coverage note: RainViewer aggregates national radar networks, and coverage
 * over Luzon is not guaranteed at all times. An empty radar layer therefore
 * means "no radar returns available", NOT "no rain" — which is why the
 * forecast figures beside this map, not the map, drive the alerts.
 */
export default function RainfallMap({
  radar,
  height = 460,
}: {
  radar: RadarData | null;
  height?: number;
}) {
  const frames = radar?.frames ?? [];
  const [index, setIndex] = useState(Math.max(0, frames.length - 1));

  const active = frames[Math.min(index, frames.length - 1)];
  const url = useMemo(
    () => (radar && active ? tileUrl(radar.host, active.path) : null),
    [radar, active],
  );

  const label = active
    ? new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(active.time * 1000))
    : null;

  return (
    <Box sx={{ position: 'relative', height, width: '100%', borderRadius: 3, overflow: 'hidden' }}>
      <Map
        initialViewState={{ ...SAN_MANUEL_CENTER, zoom: 7.6 }}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-left" />
        {/* Top-right: the bottom edge is taken by the time slider and the
            attribution, and a full-width slider collided with both. */}
        <ScaleControl position="top-right" />

        {url && (
          // `key` forces a new source when the frame changes; MapLibre will not
          // swap the tile url of a live raster source in place.
          <Source
            key={active!.path}
            id="radar"
            type="raster"
            tiles={[url]}
            tileSize={256}
            maxzoom={RADAR_MAX_ZOOM}
          >
            <Layer id="radar-layer" type="raster" source="radar" paint={{ 'raster-opacity': 0.7 }} />
          </Source>
        )}

        {/* At radar zoom San Manuel is a few pixels across. A thin dashed
            outline was effectively invisible, leaving no way to tell whether
            a rain cell was over the municipality or two towns away — which is
            the only question this map exists to answer. A tinted fill plus a
            heavier outline makes it findable at a glance. */}
        <Source id="sm-boundary" type="geojson" data="/geo/sanmanuel-boundary.geojson">
          <Layer
            id="sm-boundary-fill"
            type="fill"
            source="sm-boundary"
            paint={{ 'fill-color': '#1565C0', 'fill-opacity': 0.12 }}
          />
          <Layer
            id="sm-boundary-line"
            type="line"
            source="sm-boundary"
            paint={{ 'line-color': '#0D47A1', 'line-width': 3 }}
          />
        </Source>
      </Map>

      {frames.length > 1 && (
        <Paper
          elevation={3}
          // Raised clear of MapLibre's attribution bar, which sits flush to
          // the bottom edge of the canvas.
          sx={{ position: 'absolute', left: 12, right: 12, bottom: 30, px: 2, py: 1, borderRadius: 2 }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{ minWidth: 96 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                Radar time
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {label}
              </Typography>
            </Box>
            <Slider
              size="small"
              min={0}
              max={frames.length - 1}
              value={Math.min(index, frames.length - 1)}
              onChange={(_, v) => setIndex(v as number)}
              aria-label="Radar time"
              marks
            />
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {index === frames.length - 1 ? 'latest' : `${frames.length - 1 - index} back`}
            </Typography>
          </Stack>
        </Paper>
      )}

      {!radar && (
        <Paper
          elevation={3}
          sx={{ position: 'absolute', left: 12, bottom: 12, px: 2, py: 1, borderRadius: 2 }}
        >
          <Typography variant="caption" color="text.secondary">
            Radar imagery unavailable right now.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
