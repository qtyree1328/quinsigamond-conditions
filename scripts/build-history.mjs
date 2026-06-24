import { readFileSync, writeFileSync } from "node:fs";

const numberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toF = (value, unit) => {
  const n = numberOrNull(value);
  if (n === null) return null;
  return unit === "deg C" ? (n * 9) / 5 + 32 : n;
};

const toFt = (value, unit) => {
  const n = numberOrNull(value);
  if (n === null) return null;
  return unit === "m" ? n * 3.28084 : n;
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  return body
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((key, index) => [key, r[index]])));
};

const usgsDaily = JSON.parse(readFileSync("data/usgs_daily.json", "utf8"));
const weatherDaily = JSON.parse(readFileSync("data/weather_daily.json", "utf8"));
const fieldMeasurements = JSON.parse(readFileSync("data/usgs_field_measurements.json", "utf8"));
const wqpRows = parseCsv(readFileSync("data/wqp_quinsigamond_samples.csv", "utf8"));

const daily = new Map();
const touchDay = (date) => {
  if (!daily.has(date)) daily.set(date, { date });
  return daily.get(date);
};

for (const series of usgsDaily.value.timeSeries ?? []) {
  const parameter = series.variable?.variableCode?.[0]?.value;
  const unit = series.variable?.unit?.unitCode;
  for (const point of series.values?.[0]?.value ?? []) {
    const date = point.dateTime.slice(0, 10);
    const value = numberOrNull(point.value);
    const record = touchDay(date);

    if (parameter === "00060") {
      record.flowCfs = value;
      record.flowQualifier = point.qualifiers?.join(",") ?? null;
    }

    if (parameter === "00065") {
      record.gageHeightFt = value;
      record.gageQualifier = point.qualifiers?.join(",") ?? null;
    }

    if (unit) record.usgsUnit = unit;
  }
}

const weather = weatherDaily.daily ?? {};
for (let i = 0; i < (weather.time ?? []).length; i += 1) {
  const record = touchDay(weather.time[i]);
  record.precipIn = numberOrNull(weather.precipitation_sum?.[i]);
  record.airMeanF = numberOrNull(weather.temperature_2m_mean?.[i]);
  record.airMaxF = numberOrNull(weather.temperature_2m_max?.[i]);
  record.airMinF = numberOrNull(weather.temperature_2m_min?.[i]);
  record.windMaxMph = numberOrNull(weather.wind_speed_10m_max?.[i]);
  record.solarMjM2 = numberOrNull(weather.shortwave_radiation_sum?.[i]);
}

const field = (fieldMeasurements.features ?? [])
  .map((feature) => {
    const p = feature.properties ?? {};
    return {
      date: p.time?.slice(0, 10) ?? null,
      datetime: p.time ?? null,
      reading: p.reading_type ?? null,
      parameter: p.parameter_code ?? null,
      value: numberOrNull(p.value),
      unit: p.unit_of_measure ?? null,
      condition: p.control_condition ?? null,
      rating: p.measurement_rated ?? null,
      agency: p.measuring_agency ?? null,
    };
  })
  .filter((record) => record.date && record.value !== null)
  .sort((a, b) => a.datetime.localeCompare(b.datetime));

const wantedCharacteristics = new Set([
  "Temperature, water",
  "Turbidity",
  "Dissolved oxygen (DO)",
  "Dissolved oxygen saturation",
  "Orthophosphate",
  "Nitrate",
  "Conductivity",
  "Specific conductance",
  "pH",
  "Total Phosphorus, mixed forms",
  "Depth, Secchi disk depth",
  "Chlorophyll a",
  "Phycocyanin",
]);

const qualitySamples = wqpRows
  .map((row) => {
    const characteristic = row.CharacteristicName;
    const value = numberOrNull(row.ResultMeasureValue);
    if (!wantedCharacteristics.has(characteristic) || value === null) return null;

    const unit = row["ResultMeasure/MeasureUnitCode"] || null;
    const time = row["ActivityStartTime/Time"] || "";
    const date = row.ActivityStartDate;
    return {
      date,
      datetime: time ? `${date}T${time}` : date,
      station: row.MonitoringLocationIdentifier || null,
      organization: row.OrganizationIdentifier || null,
      characteristic,
      value,
      unit,
      valueF: characteristic === "Temperature, water" ? toF(value, unit) : null,
      valueFt: characteristic === "Depth, Secchi disk depth" ? toFt(value, unit) : null,
      status: row.ResultStatusIdentifier || null,
      provider: row.ProviderName || null,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.datetime.localeCompare(b.datetime));

const dailyRecords = Array.from(daily.values())
  .sort((a, b) => a.date.localeCompare(b.date))
  .map((record) => ({
    date: record.date,
    flowCfs: record.flowCfs ?? null,
    gageHeightFt: record.gageHeightFt ?? null,
    precipIn: record.precipIn ?? null,
    airMeanF: record.airMeanF ?? null,
    airMaxF: record.airMaxF ?? null,
    airMinF: record.airMinF ?? null,
    windMaxMph: record.windMaxMph ?? null,
    solarMjM2: record.solarMjM2 ?? null,
    flowQualifier: record.flowQualifier ?? null,
    gageQualifier: record.gageQualifier ?? null,
  }));

const latestBy = (items, keyFn) => {
  const map = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map[key] || item.datetime > map[key].datetime) map[key] = item;
  }
  return map;
};

const output = {
  generatedAt: new Date().toISOString(),
  station: {
    id: "USGS-01110000",
    name: "Quinsigamond River at North Grafton, MA",
    latitude: 42.230372,
    longitude: -71.7109023,
    note: "The public USGS live monitor is downstream of Lake Quinsigamond and is best treated as river outlet context, not an in-lake buoy.",
  },
  lake: {
    name: "Lake Quinsigamond",
    latitude: 42.278,
    longitude: -71.756,
  },
  sources: [
    {
      label: "Worcester 2024 Lake Quinsigamond Report",
      url: "https://www.worcesterma.gov/sustainability-resilience/document-center/water-quality-report-2024-lake-quinsigamond.pdf",
      role: "Documents the in-lake continuous monitoring buoys, beach closures, and 2024 water-quality results.",
    },
    {
      label: "Worcester Lakes & Ponds Program",
      url: "https://www.worcesterma.gov/sustainability-resilience/recreational-waters",
      role: "City lake monitoring, WCMC, closure alerts, and annual State of the Lakes reporting.",
    },
    {
      label: "NexSens WQData LIVE",
      url: "https://www.nexsens.com/products/software/web-datacenter",
      role: "Candidate platform for public buoy dashboards and API access if Worcester exposes the project.",
    },
    {
      label: "USGS Water Services",
      url: "https://waterservices.usgs.gov/nwis/",
      role: "Live gage height, discharge, and daily discharge history at the downstream outlet station.",
    },
    {
      label: "USGS OGC Field Measurements",
      url: "https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements",
      role: "Approved manual field measurements at USGS-01110000.",
    },
    {
      label: "Water Quality Portal",
      url: "https://www.waterqualitydata.us/",
      role: "Historical sample data for temperature, turbidity, nutrients, oxygen, and conductivity.",
    },
    {
      label: "Open-Meteo",
      url: "https://open-meteo.com/",
      role: "Current, forecast, and historical weather near the lake.",
    },
    {
      label: "Wikimedia Commons",
      url: "https://commons.wikimedia.org/wiki/File:Lake_Quinsigamond_view_from_REGATTA_Point_Park_MA_-_panoramio.jpg",
      role: "Local masthead image.",
    },
  ],
  daily: dailyRecords,
  fieldMeasurements: field,
  latestFieldMeasurements: latestBy(field, (item) => item.parameter),
  qualitySamples,
  latestQualitySamples: latestBy(qualitySamples, (item) => item.characteristic),
};

writeFileSync("data/hub_history.json", `${JSON.stringify(output)}\n`);

console.log(
  JSON.stringify(
    {
      dailyRecords: output.daily.length,
      fieldMeasurements: output.fieldMeasurements.length,
      qualitySamples: output.qualitySamples.length,
      latestWaterTemp: output.latestQualitySamples["Temperature, water"] ?? null,
    },
    null,
    2,
  ),
);
