# Lake Quinsigamond Conditions

Static dashboard for current Lake Quinsigamond conditions and historical context.

## Run locally

```sh
python3 -m http.server 4173
```

Open http://127.0.0.1:4173/

The page fetches live USGS and Open-Meteo data in the browser and loads cached historical data from `data/hub_history.json`.

## Refresh historical data

```sh
node scripts/refresh-data.mjs
```

This downloads:

- USGS daily discharge history for `USGS-01110000`
- USGS field measurements for `USGS-01110000`
- Water Quality Portal samples from in-lake Lake Quinsigamond stations, Flint Pond context stations, tributaries, and the Quinsigamond River outlet
- Open-Meteo historical daily weather near the lake

Then it rebuilds `data/hub_history.json`.

## Source hierarchy

1. Worcester in-lake monitoring buoys should be the primary live water-quality source once public access is available. Worcester's 2024 Lake Quinsigamond report says two buoys were deployed in 2024 and that they measure temperature, turbidity, chlorophyll and phycocyanin every 30 minutes.
2. Open-Meteo provides live local air, wind, humidity, sun and forecast weather.
3. DCR beach testing should drive a swim-safety card for Regatta Point and Lake Park once a reliable public feed is found.
4. USGS `01110000` is downstream outlet context, not an in-lake monitor.
5. WQP/MassDEP/MAWRRC/NALMS records provide historical water-quality context.

## Current limitation

The public USGS monitor is downstream of the lake and does not publish live water temperature. Worcester appears to have the right in-lake buoy data, but the public WQData LIVE project/API endpoint was not found. Ask the Worcester Lakes & Ponds Program for a public dashboard link, project ID, or API key.
