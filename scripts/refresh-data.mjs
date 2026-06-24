import { mkdir, writeFile } from "node:fs/promises";

const today = new Date();
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const todayIso = today.toISOString().slice(0, 10);
const yesterdayIso = yesterday.toISOString().slice(0, 10);

const downloads = [
  {
    path: "data/usgs_daily.json",
    url: `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=01110000&startDT=2007-10-01&endDT=${todayIso}&parameterCd=00065,00060`,
  },
  {
    path: "data/weather_daily.json",
    url: `https://archive-api.open-meteo.com/v1/archive?latitude=42.278&longitude=-71.756&start_date=2007-10-01&end_date=${yesterdayIso}&daily=precipitation_sum,temperature_2m_mean,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,shortwave_radiation_sum&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York`,
  },
  {
    path: "data/usgs_field_measurements.json",
    url: "https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements/items?f=json&monitoring_location_id=USGS-01110000&limit=10000",
  },
  {
    path: "data/wqp_quinsigamond_samples.csv",
    url: "https://www.waterqualitydata.us/data/Result/search?siteid=MASSDEP-W1085%3BMASSDEP-W1897%3BMASSDEP-W2932%3BMASSDEP-W0689%3BMASSDEP-W1282%3BMASSDEP-W1753%3BMASSDEP-W1758%3BMAWRRC_WQX-51125%3BMAWRRC_WQX-51050%3BMAWRRC_WQX-51188%3BNALMS-F610537%3BBRC-A-07-07-005%3BBRC-A-07-07-010%3BBRC-A-07-07-020%3BBRC-A-07-07-030%3BUSGS-01110000&characteristicName=Temperature%2C%20water%3BTurbidity%3BDissolved%20oxygen%20%28DO%29%3BDissolved%20oxygen%20saturation%3BOrthophosphate%3BNitrate%3BConductivity%3BSpecific%20conductance%3BpH%3BTotal%20Phosphorus%2C%20mixed%20forms%3BDepth%2C%20Secchi%20disk%20depth%3BChlorophyll%20a%3BPhycocyanin&mimeType=csv&zip=no&sorted=no",
  },
];

await mkdir("data", { recursive: true });

for (const item of downloads) {
  process.stdout.write(`Downloading ${item.path}... `);
  const response = await fetch(item.url);
  if (!response.ok) {
    throw new Error(`${item.path} failed with ${response.status}`);
  }
  await writeFile(item.path, await response.text());
  process.stdout.write("done\n");
}

await import("./build-history.mjs");
