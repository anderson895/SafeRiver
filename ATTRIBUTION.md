# Data Sources and Attribution

This system presents data produced by others. Every source is credited below,
with its licence and what is required of anyone redistributing it.

---

## Flood hazard maps — Project NOAH / UP NOAH Center

**Licence: Open Data Commons Open Database License (ODbL) v1.0**
<https://opendatacommons.org/licenses/odbl/1-0/>

Source: `bettergovph/project-noah-hazard-maps` on Hugging Face, derived from the
downloadable products of Project NOAH (Nationwide Operational Assessment of
Hazards), UP NOAH Center. Provincial flood hazard shapefiles for Pangasinan at
5-, 25- and 100-year return periods.

**ODbL is share-alike, and that obligation is binding, not optional.** The files
in `public/geo/flood-*.geojson` are a Derivative Database: they were clipped to
the San Manuel municipal boundary and had adjacent same-class polygons
dissolved. They are therefore redistributed **under ODbL v1.0**, and anyone
using them must:

1. Attribute Project NOAH / UP NOAH Center.
2. Keep any further derivative under ODbL.
3. Not use technical measures that restrict others from doing the same.

Reproduce the derivation with `npm run gis:build` — see
`scripts/gis/build-layers.mjs`.

### Measured characteristics

These were measured against the delivered geometry, not taken from the dataset
description, because the two disagree.

| Property | Value | How it was determined |
|---|---|---|
| Cell size | **30 m** | 97.5% of 35,322 polygon segments are exactly 30.0 m |
| Attribute | `Var` = 1 / 2 / 3 | Low / Medium / High hazard |
| Coordinate system | EPSG:4326 | `.prj` reports `GCS_WGS_1984` |

The upstream dataset description credits 1 m LiDAR/IfSAR DEMs as modelling
input. Whatever the input, **the published product is 30 m**, and that is what
should be cited when describing the system's spatial resolution.

---

## Dam water levels and releases — DOST-PAGASA

Source: <https://www.pagasa.dost.gov.ph/flood> — the daily Dam Information
bulletin, published at approximately 08:00 PHT.

Used for Ambuklao, Binga and San Roque (the Agno River cascade), plus the
river-basin flood watch status. Retrieved by polite scraping at 30-minute
intervals with an identifying User-Agent; the underlying bulletin changes once
a day.

PAGASA is a Philippine government agency and its published advisories are
public information. This system **relays** those advisories and does not
originate, modify or interpret the readings beyond deriving alert thresholds,
which are this project's own and are documented as provisional.

---

## Rainfall forecast and river discharge — Open-Meteo

**Licence: CC BY 4.0** — <https://open-meteo.com/en/license>

- Hourly precipitation forecast for San Manuel (16.0708, 120.6647)
- Agno River discharge from the **GloFAS v4** global flood model, via the
  Open-Meteo Flood API

Weather data by Open-Meteo.com. GloFAS is a product of the Copernicus Emergency
Management Service.

---

## Rain radar — RainViewer

Radar imagery © RainViewer, used via their public tile service.
<https://www.rainviewer.com/api.html>

Radar coverage over Luzon is not continuous. An empty radar frame indicates no
returns are available, **not** an absence of rain — the interface states this
wherever radar is shown.

---

## Administrative boundaries — GADM

Source: GADM v4.1, level 3 (barangay), filtered to San Manuel, Pangasinan.
<https://gadm.org/license.html> — free for academic and other non-commercial
use. **Not redistributable for commercial purposes.**

### Known discrepancy

GADM puts San Manuel at **119.1 km²** against an official land area of
**129.18 km²** (Philippine Statistics Authority) — roughly 8% short. GADM is a
generalised global product; this is inherent to it, not a processing error, and
no better freely licensed boundary was available.

---

## Base map — OpenFreeMap / OpenMapTiles / OpenStreetMap

Base map © OpenFreeMap, © OpenMapTiles, data from OpenStreetMap contributors.

OpenStreetMap data is © OpenStreetMap contributors, available under the Open
Database License. <https://www.openstreetmap.org/copyright>

Note that place labels come from OpenStreetMap while administrative polygons
come from GADM. The two are independent and are **not co-registered**, so a
village label may not sit inside the barangay polygon a reader expects.

---

## Software

Built with Next.js, React, MUI, MapLibre GL JS and Firebase. Geospatial
processing with mapshaper. See `package.json` for the full dependency list and
their respective licences.

---

## What this system does not do

It does not perform hydrodynamic flood simulation. It presents and relays
hazard mapping and official advisories produced by the agencies above. All
modelling credit belongs to Project NOAH, PAGASA and Copernicus/GloFAS.
