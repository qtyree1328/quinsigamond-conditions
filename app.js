const HISTORY_URL = "data/hub_history.json";
const USGS_IV_URL =
  "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01110000&parameterCd=00065,00060&period=P30D";
const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=42.278&longitude=-71.756&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,uv_index_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York";

const DEG = "\u00B0";
const state = {
  history: null,
  live: null,
  weather: null,
};

const els = {
  feedStatus: byId("feedStatus"),
  todayTitle: byId("todayTitle"),
  todaySummary: byId("todaySummary"),
  gageValue: byId("gageValue"),
  gageMeta: byId("gageMeta"),
  flowValue: byId("flowValue"),
  flowMeta: byId("flowMeta"),
  airValue: byId("airValue"),
  airMeta: byId("airMeta"),
  windValue: byId("windValue"),
  windMeta: byId("windMeta"),
  humidityValue: byId("humidityValue"),
  cloudMeta: byId("cloudMeta"),
  sunValue: byId("sunValue"),
  sunMeta: byId("sunMeta"),
  temperatureTitle: byId("temperatureTitle"),
  temperatureDetail: byId("temperatureDetail"),
  tempReadout: byId("tempReadout"),
  waterTempReadout: byId("waterTempReadout"),
  recentStat: byId("recentStat"),
  yearStat: byId("yearStat"),
  responseStat: byId("responseStat"),
  qualityStat: byId("qualityStat"),
  waterTempStat: byId("waterTempStat"),
  insights: byId("insights"),
  sampleList: byId("sampleList"),
  sourceLinks: byId("sourceLinks"),
  recentLegend: byId("recentLegend"),
  yearLegend: byId("yearLegend"),
  responseLegend: byId("responseLegend"),
};

const charts = {
  recent: byId("recentChart"),
  year: byId("yearChart"),
  response: byId("responseChart"),
  waterTemp: byId("waterTempChart"),
};

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", debounce(drawCharts, 120));

async function init() {
  try {
    state.history = await fetchJson(HISTORY_URL);
    renderStatic();
    drawCharts();
  } catch (error) {
    setText(els.feedStatus, "Could not load local historical cache");
    console.error(error);
    return;
  }

  const [liveResult, weatherResult] = await Promise.allSettled([
    fetchJson(USGS_IV_URL),
    fetchJson(WEATHER_URL),
  ]);

  if (liveResult.status === "fulfilled") {
    state.live = parseUsgsInstant(liveResult.value);
  }

  if (weatherResult.status === "fulfilled") {
    state.weather = weatherResult.value;
  }

  renderLive();
  drawCharts();
}

function byId(id) {
  return document.getElementById(id);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

function parseUsgsInstant(data) {
  const series = {};
  for (const item of data.value?.timeSeries ?? []) {
    const code = item.variable?.variableCode?.[0]?.value;
    if (!code) continue;
    series[code] = {
      code,
      label: item.variable?.variableDescription ?? code,
      unit: item.variable?.unit?.unitCode ?? "",
      values: (item.values?.[0]?.value ?? [])
        .map((point) => ({
          datetime: point.dateTime,
          date: point.dateTime.slice(0, 10),
          value: numberOrNull(point.value),
          qualifiers: point.qualifiers ?? [],
        }))
        .filter((point) => point.value !== null),
    };
  }
  return series;
}

function renderStatic() {
  renderSources();
  renderSamples();
  renderInsights();

  const latestQuality = state.history.latestQualitySamples["Temperature, water"];
  if (latestQuality?.valueF) {
    setText(
      els.waterTempReadout,
      `Last public sample ${fmt(latestQuality.valueF, 1)}${DEG}F on ${formatDate(latestQuality.date)}`,
    );
  }
}

function renderLive() {
  const weather = state.weather?.current;
  const daily = state.weather?.daily;
  const gage = latestPoint("00065");
  const flow = latestPoint("00060");
  const flowContext = flow ? flowVsTypical(flow.value, flow.date) : null;
  const weatherLabel = weather ? weatherCodeLabel(weather.weather_code) : "Conditions";

  styleWeather(weather);

  if (weather && gage) {
    setText(
      els.todayTitle,
      `${weatherLabel}, ${fmt(weather.temperature_2m, 0)}${DEG}F, outlet height ${fmt(gage.value, 2)} ft`,
    );
  } else if (weather) {
    setText(els.todayTitle, `${weatherLabel}, ${fmt(weather.temperature_2m, 0)}${DEG}F`);
  } else {
    setText(els.todayTitle, "Today on the lake");
  }

  const summaryParts = [];
  if (flow) {
    summaryParts.push(`Flow ${fmt(flow.value, 1)} cfs`);
  }
  if (flowContext) {
    summaryParts.push(`${flowContext.phrase} for this date`);
  }
  if (weather) {
    summaryParts.push(
      `${compass(weather.wind_direction_10m)} wind ${fmt(weather.wind_speed_10m, 0)} mph`,
    );
    summaryParts.push(`${fmt(weather.relative_humidity_2m, 0)}% humidity`);
  }
  setText(els.todaySummary, summaryParts.length ? summaryParts.join(". ") + "." : "Live feeds are unavailable.");

  if (gage) {
    const delta = deltaFromSeries(state.live["00065"], 24);
    setText(els.gageValue, `${fmt(gage.value, 2)} ft`);
    setText(els.gageMeta, `${deltaText(delta, "ft")} | USGS outlet ${timeOnly(gage.datetime)}`);
  } else {
    setText(els.gageValue, "--");
    setText(els.gageMeta, "Live gage unavailable");
  }

  if (flow) {
    const delta = deltaFromSeries(state.live["00060"], 24);
    setText(els.flowValue, `${fmt(flow.value, 1)} cfs`);
    setText(els.flowMeta, `${deltaText(delta, "cfs")} | ${timeOnly(flow.datetime)}`);
  } else {
    const fallback = latestDailyFlow();
    setText(els.flowValue, fallback ? `${fmt(fallback.flowCfs, 1)} cfs` : "--");
    setText(els.flowMeta, fallback ? `Cached daily value ${formatDate(fallback.date)}` : "No flow data");
  }

  if (weather) {
    setText(els.airValue, `${fmt(weather.temperature_2m, 0)}${DEG}F`);
    setText(els.airMeta, `Feels ${fmt(weather.apparent_temperature, 0)}${DEG}F | ${weatherCodeLabel(weather.weather_code)}`);
    setText(els.windValue, `${fmt(weather.wind_speed_10m, 0)} mph`);
    setText(els.windMeta, `${compass(weather.wind_direction_10m)} | gust ${fmt(weather.wind_gusts_10m, 0)} mph`);
    setText(els.humidityValue, `${fmt(weather.relative_humidity_2m, 0)}%`);
    setText(els.cloudMeta, `Cloud cover ${fmt(weather.cloud_cover, 0)}%`);
    setText(els.tempReadout, `${fmt(weather.temperature_2m, 0)}${DEG}F`);
    setText(
      els.temperatureDetail,
      `Air feels ${fmt(weather.apparent_temperature, 0)}${DEG}F with ${fmt(weather.cloud_cover, 0)}% cloud cover. Worcester's in-lake buoy feed is the right future source for live water temperature.`,
    );
  }

  if (daily?.sunrise?.length) {
    const sunrise = shortTime(daily.sunrise[0]);
    const sunset = shortTime(daily.sunset[0]);
    setText(els.sunValue, `${sunrise} / ${sunset}`);
    setText(
      els.sunMeta,
      `UV ${fmt(daily.uv_index_max?.[0], 1)} | rain ${fmt(daily.precipitation_sum?.[0], 2)} in`,
    );
  }

  const failures = [];
  if (!state.live) failures.push("USGS live");
  if (!state.weather) failures.push("weather");
  const built = state.history.generatedAt ? formatDateTime(state.history.generatedAt) : "cache";
  const latestLive = gage?.datetime ? `USGS ${timeOnly(gage.datetime)}` : "USGS cached";
  const latestWeather = weather?.time ? `weather ${shortTime(weather.time)}` : "weather cached";
  setText(
    els.feedStatus,
    failures.length
      ? `Live issue: ${failures.join(", ")} | cache ${built}`
      : `${latestWeather} | ${latestLive} | cache ${built}`,
  );

  drawCharts();
}

function renderSources() {
  els.sourceLinks.replaceChildren();
  for (const source of state.history.sources) {
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = source.label;
    link.title = source.role;
    els.sourceLinks.append(link);
  }
}

function renderSamples() {
  const latest = state.history.latestQualitySamples;
  const ordered = [
    "Temperature, water",
    "Depth, Secchi disk depth",
    "Turbidity",
    "Chlorophyll a",
    "Phycocyanin",
    "Dissolved oxygen (DO)",
    "Dissolved oxygen saturation",
    "Total Phosphorus, mixed forms",
    "Orthophosphate",
    "Nitrate",
    "Specific conductance",
    "Conductivity",
    "pH",
  ];

  els.sampleList.replaceChildren();
  for (const key of ordered) {
    if (key === "Conductivity" && latest["Specific conductance"]) continue;
    const sample = latest[key];
    if (!sample) continue;
    const row = document.createElement("div");
    row.className = "sample-row";

    const label = document.createElement("div");
    const labelTop = document.createElement("span");
    labelTop.textContent = readableCharacteristic(key);
    const small = document.createElement("small");
    small.textContent = `${formatDate(sample.date)} | ${sample.station}`;
    label.append(labelTop, small);

    const value = document.createElement("strong");
    value.textContent = formatSample(sample);
    row.append(label, value);
    els.sampleList.append(row);
  }

  const latestDate = Object.values(latest)
    .map((sample) => sample.date)
    .sort()
    .at(-1);
  setText(els.qualityStat, latestDate ? `Latest ${formatDate(latestDate)}` : "--");
}

function renderInsights() {
  const records = state.history.daily.filter((d) => d.flowCfs !== null);
  const rainRecords = state.history.daily.filter((d) => d.precipIn !== null);
  const maxFlow = maxBy(records, (d) => d.flowCfs);
  const minFlow = minBy(records, (d) => d.flowCfs);
  const wettest = maxBy(rainRecords, (d) => d.precipIn);
  const fastestRise = records
    .slice(1)
    .map((d, i) => ({ date: d.date, rise: d.flowCfs - records[i].flowCfs, flow: d.flowCfs }))
    .sort((a, b) => b.rise - a.rise)[0];
  const currentYear = latestYear();
  const yearRecords = records.filter((d) => yearOf(d.date) === currentYear);
  const yearAverage = mean(yearRecords.map((d) => d.flowCfs));
  const previousAverages = groupBy(records.filter((d) => yearOf(d.date) < currentYear), (d) => yearOf(d.date))
    .map((items) => mean(items.map((d) => d.flowCfs)))
    .filter(Number.isFinite);
  const rank = percentile(previousAverages, yearAverage);

  const insights = [
    {
      value: `${fmt(maxFlow.flowCfs, 1)} cfs`,
      label: "Highest flow",
      text: `${formatDate(maxFlow.date)} was the highest cached daily mean at USGS-01110000.`,
    },
    {
      value: `${fmt(minFlow.flowCfs, 2)} cfs`,
      label: "Lowest flow",
      text: `${formatDate(minFlow.date)} was the lowest cached daily mean.`,
    },
    {
      value: `${fmt(wettest.precipIn, 2)} in`,
      label: "Wettest day",
      text: `${formatDate(wettest.date)} had the largest modeled daily rainfall near the lake.`,
    },
    {
      value: `+${fmt(fastestRise.rise, 1)} cfs`,
      label: "Fastest rise",
      text: `${formatDate(fastestRise.date)} had the sharpest one-day flow jump in the cached record.`,
    },
    {
      value: `${fmt(rank, 0)}th`,
      label: "Year rank",
      text: `${currentYear} average flow is at this percentile among prior full-year averages so far.`,
    },
  ];

  els.insights.replaceChildren();
  for (const insight of insights) {
    const item = document.createElement("div");
    item.className = "insight";
    const left = document.createElement("div");
    const value = document.createElement("strong");
    value.textContent = insight.value;
    const label = document.createElement("span");
    label.textContent = insight.label;
    left.append(value, label);
    const text = document.createElement("p");
    text.textContent = insight.text;
    item.append(left, text);
    els.insights.append(item);
  }
}

function drawCharts() {
  if (!state.history) return;
  drawRecentChart();
  drawYearChart();
  drawResponseChart();
  drawWaterTempChart();
}

function drawRecentChart() {
  const canvas = charts.recent;
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;

  const daily = state.history.daily.slice(-45);
  const liveGage = state.live?.["00065"]?.values ?? [];
  const liveFlow = state.live?.["00060"]?.values ?? [];

  if (!daily.length) {
    drawEmpty(ctx, canvas, "No recent data");
    return;
  }

  const plot = plotBox(canvas);
  drawGrid(ctx, plot);

  const start = Date.parse(`${daily[0].date}T00:00:00`);
  const end = Date.parse(`${daily.at(-1).date}T23:59:00`);
  const xForTime = (time) => plot.left + ((time - start) / (end - start || 1)) * plot.width;

  const rainMax = Math.max(0.1, ...daily.map((d) => d.precipIn ?? 0));
  ctx.fillStyle = "rgba(243, 180, 75, 0.38)";
  const barWidth = Math.max(3, plot.width / daily.length / 2);
  for (const d of daily) {
    const rain = d.precipIn ?? 0;
    const h = (rain / rainMax) * plot.height * 0.34;
    const x = xForTime(Date.parse(`${d.date}T12:00:00`));
    ctx.fillRect(x - barWidth / 2, plot.bottom - h, barWidth, h);
  }

  const flowDaily = daily
    .filter((d) => d.flowCfs !== null)
    .map((d) => ({ x: Date.parse(`${d.date}T12:00:00`), y: d.flowCfs }));
  const liveFlowPoints = thin(
    liveFlow.map((d) => ({ x: Date.parse(d.datetime), y: d.value })).filter((p) => p.x >= start),
    520,
  );
  const flowPoints = liveFlowPoints.length > 10 ? liveFlowPoints : flowDaily;
  const flowExtent = extent(flowPoints.map((p) => p.y));
  drawLine(
    ctx,
    flowPoints,
    (p) => xForTime(p.x),
    (p) => scale(p.y, flowExtent.min, flowExtent.max, plot.bottom, plot.top),
    "#137d91",
    3,
  );

  if (liveGage.length) {
    const gagePoints = thin(
      liveGage.map((d) => ({ x: Date.parse(d.datetime), y: d.value })).filter((p) => p.x >= start),
      520,
    );
    const gageExtent = extent(gagePoints.map((p) => p.y));
    drawLine(
      ctx,
      gagePoints,
      (p) => xForTime(p.x),
      (p) => scale(p.y, gageExtent.min, gageExtent.max, plot.bottom, plot.top),
      "#517a4b",
      2.4,
    );
  }

  drawXAxisDates(ctx, plot, daily.map((d) => d.date));
  setLegend(els.recentLegend, [
    ["Flow", "#137d91"],
    ["Gage", "#517a4b"],
    ["Rain", "#f3b44b"],
  ]);

  const latestFlow = latestPoint("00060");
  const latestGage = latestPoint("00065");
  if (latestFlow && latestGage) {
    setText(
      els.recentStat,
      `${fmt(latestGage.value, 2)} ft | ${fmt(latestFlow.value, 1)} cfs now`,
    );
  } else {
    const fallback = latestDailyFlow();
    setText(els.recentStat, fallback ? `${fmt(fallback.flowCfs, 1)} cfs cached` : "--");
  }
}

function drawYearChart() {
  const canvas = charts.year;
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;

  const records = state.history.daily.filter((d) => d.flowCfs !== null);
  const currentYear = latestYear();
  const previous = records.filter((d) => yearOf(d.date) < currentYear);
  const current = records.filter((d) => yearOf(d.date) === currentYear);

  if (!current.length || !previous.length) {
    drawEmpty(ctx, canvas, "No yearly data");
    return;
  }

  const stats = [];
  for (let doy = 1; doy <= 366; doy += 1) {
    const values = previous.filter((d) => dayOfYear(d.date) === doy).map((d) => d.flowCfs);
    if (values.length) {
      stats.push({
        doy,
        p25: quantile(values, 0.25),
        median: quantile(values, 0.5),
        p75: quantile(values, 0.75),
      });
    }
  }

  const plot = plotBox(canvas);
  drawGrid(ctx, plot);
  const allY = [
    ...stats.flatMap((d) => [d.p25, d.median, d.p75]),
    ...current.map((d) => d.flowCfs),
  ];
  const yExtent = extent(allY);
  const x = (doy) => plot.left + ((doy - 1) / 365) * plot.width;
  const y = (value) => scale(value, yExtent.min, yExtent.max, plot.bottom, plot.top);

  ctx.beginPath();
  for (const [index, point] of stats.entries()) {
    const fn = index === 0 ? "moveTo" : "lineTo";
    ctx[fn](x(point.doy), y(point.p75));
  }
  for (let i = stats.length - 1; i >= 0; i -= 1) {
    const point = stats[i];
    ctx.lineTo(x(point.doy), y(point.p25));
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(91, 133, 199, 0.14)";
  ctx.fill();

  drawLine(ctx, stats, (p) => x(p.doy), (p) => y(p.median), "#5b85c7", 2.2);
  drawLine(
    ctx,
    current.map((d) => ({ doy: dayOfYear(d.date), flow: d.flowCfs })),
    (p) => x(p.doy),
    (p) => y(p.flow),
    "#d9694f",
    3,
  );

  drawMonthMarks(ctx, plot);
  setLegend(els.yearLegend, [
    [`${currentYear}`, "#d9694f"],
    ["Historical median", "#5b85c7"],
    ["Typical range", "rgba(91, 133, 199, 0.42)"],
  ]);

  const latest = current.at(-1);
  const typical = stats.find((s) => s.doy === dayOfYear(latest.date));
  if (latest && typical?.median) {
    const diff = ((latest.flowCfs - typical.median) / typical.median) * 100;
    setText(els.yearStat, `${signed(diff, 0)}% vs median for ${formatDateShort(latest.date)}`);
  }
}

function drawResponseChart() {
  const canvas = charts.response;
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;

  const records = state.history.daily.filter((d) => d.flowCfs !== null && d.precipIn !== null);
  const points = [];
  for (let i = 0; i < records.length - 1; i += 1) {
    const today = records[i];
    const tomorrow = records[i + 1];
    if ((today.precipIn ?? 0) < 0.01) continue;
    points.push({
      date: today.date,
      precip: today.precipIn,
      rise: tomorrow.flowCfs - today.flowCfs,
    });
  }

  if (!points.length) {
    drawEmpty(ctx, canvas, "No rain response data");
    return;
  }

  const plot = plotBox(canvas);
  drawGrid(ctx, plot);
  const xExtent = { min: 0, max: Math.max(0.5, ...points.map((p) => p.precip)) };
  const yExtent = extent(points.map((p) => p.rise));
  const x = (value) => scale(value, xExtent.min, xExtent.max, plot.left, plot.right);
  const y = (value) => scale(value, yExtent.min, yExtent.max, plot.bottom, plot.top);

  ctx.fillStyle = "rgba(19, 125, 145, 0.34)";
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(x(point.precip), y(point.rise), 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const top = maxBy(points, (p) => p.rise);
  ctx.fillStyle = "#d9694f";
  ctx.beginPath();
  ctx.arc(x(top.precip), y(top.rise), 5, 0, Math.PI * 2);
  ctx.fill();

  drawAxisLabels(ctx, plot, "rain in", "next-day cfs change");
  const r = correlation(points.map((p) => p.precip), points.map((p) => p.rise));
  setText(els.responseStat, `r ${fmt(r, 2)} | biggest +${fmt(top.rise, 1)} cfs`);
  setLegend(els.responseLegend, [
    ["Daily event", "#137d91"],
    ["Largest response", "#d9694f"],
  ]);
}

function drawWaterTempChart() {
  const canvas = charts.waterTemp;
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;

  const samples = state.history.qualitySamples
    .filter((s) => s.characteristic === "Temperature, water" && s.valueF !== null)
    .map((s) => ({ date: s.date, time: Date.parse(`${s.date}T12:00:00`), temp: s.valueF }));

  if (!samples.length) {
    drawEmpty(ctx, canvas, "No water temperature samples");
    return;
  }

  const plot = plotBox(canvas);
  drawGrid(ctx, plot);
  const xExtent = extent(samples.map((s) => s.time));
  const yExtent = extent(samples.map((s) => s.temp));
  const x = (value) => scale(value, xExtent.min, xExtent.max, plot.left, plot.right);
  const y = (value) => scale(value, yExtent.min, yExtent.max, plot.bottom, plot.top);

  for (const sample of samples) {
    const warm = (sample.temp - yExtent.min) / (yExtent.max - yExtent.min || 1);
    ctx.fillStyle = warm > 0.66 ? "#d9694f" : warm > 0.35 ? "#f3b44b" : "#5b85c7";
    ctx.beginPath();
    ctx.arc(x(sample.time), y(sample.temp), 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawYearMarks(ctx, plot, samples);
  const latest = samples.at(-1);
  setText(
    els.waterTempStat,
    `${fmt(latest.temp, 1)}${DEG}F on ${formatDateShort(latest.date)}`,
  );
}

function prepareCanvas(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.canvas.cssWidth = rect.width;
  ctx.canvas.cssHeight = rect.height;
  return ctx;
}

function plotBox(canvas) {
  const width = canvas.cssWidth ?? canvas.getBoundingClientRect().width;
  const height = canvas.cssHeight ?? canvas.getBoundingClientRect().height;
  return {
    left: 44,
    top: 24,
    right: width - 18,
    bottom: height - 38,
    width: width - 62,
    height: height - 62,
  };
}

function drawGrid(ctx, plot) {
  ctx.save();
  ctx.strokeStyle = "rgba(99, 112, 107, 0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = plot.top + (plot.height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(23, 32, 29, 0.18)";
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();
  ctx.restore();
}

function drawEmpty(ctx, canvas, text) {
  const width = canvas.cssWidth ?? canvas.getBoundingClientRect().width;
  const height = canvas.cssHeight ?? canvas.getBoundingClientRect().height;
  ctx.fillStyle = "#63706b";
  ctx.font = "14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2);
}

function drawLine(ctx, points, xFn, yFn, color, width = 2) {
  if (!points.length) return;
  ctx.save();
  ctx.beginPath();
  for (const [index, point] of points.entries()) {
    const x = xFn(point);
    const y = yFn(point);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

function drawXAxisDates(ctx, plot, dates) {
  const labels = [dates[0], dates[Math.floor(dates.length / 2)], dates.at(-1)].filter(Boolean);
  ctx.save();
  ctx.fillStyle = "#63706b";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const date of labels) {
    const x = plot.left + (dates.indexOf(date) / Math.max(1, dates.length - 1)) * plot.width;
    ctx.fillText(formatDateShort(date), x, plot.bottom + 24);
  }
  ctx.restore();
}

function drawMonthMarks(ctx, plot) {
  const months = [
    ["Jan", 1],
    ["Apr", 91],
    ["Jul", 182],
    ["Oct", 274],
    ["Dec", 335],
  ];
  ctx.save();
  ctx.fillStyle = "#63706b";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const [label, doy] of months) {
    const x = plot.left + ((doy - 1) / 365) * plot.width;
    ctx.fillText(label, x, plot.bottom + 24);
  }
  ctx.restore();
}

function drawYearMarks(ctx, plot, samples) {
  const first = yearOf(samples[0].date);
  const last = yearOf(samples.at(-1).date);
  const labels = [first, Math.round((first + last) / 2), last];
  ctx.save();
  ctx.fillStyle = "#63706b";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const year of labels) {
    const x = scale(
      Date.parse(`${year}-07-01T12:00:00`),
      Date.parse(`${first}-01-01T00:00:00`),
      Date.parse(`${last}-12-31T23:59:00`),
      plot.left,
      plot.right,
    );
    ctx.fillText(String(year), x, plot.bottom + 24);
  }
  ctx.restore();
}

function drawAxisLabels(ctx, plot, xLabel, yLabel) {
  ctx.save();
  ctx.fillStyle = "#63706b";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(xLabel, plot.right, plot.bottom + 24);
  ctx.save();
  ctx.translate(14, plot.top + plot.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
  ctx.restore();
}

function setLegend(container, items) {
  container.replaceChildren();
  for (const [label, color] of items) {
    const entry = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.style.background = color;
    entry.append(swatch, document.createTextNode(label));
    container.append(entry);
  }
}

function latestPoint(code) {
  const values = state.live?.[code]?.values;
  return values?.length ? values.at(-1) : null;
}

function deltaFromSeries(series, hours) {
  if (!series?.values?.length) return null;
  const latest = series.values.at(-1);
  const target = Date.parse(latest.datetime) - hours * 60 * 60 * 1000;
  let previous = series.values[0];
  for (const point of series.values) {
    if (Date.parse(point.datetime) <= target) previous = point;
    else break;
  }
  return latest.value - previous.value;
}

function flowVsTypical(value, date) {
  const currentYear = yearOf(date);
  const doy = dayOfYear(date);
  const values = state.history.daily
    .filter((d) => d.flowCfs !== null && yearOf(d.date) < currentYear)
    .filter((d) => Math.abs(dayOfYear(d.date) - doy) <= 3)
    .map((d) => d.flowCfs);
  if (!values.length) return null;
  const med = quantile(values, 0.5);
  const diff = ((value - med) / med) * 100;
  return {
    diff,
    median: med,
    phrase: Math.abs(diff) < 10 ? "near typical" : diff > 0 ? `${fmt(diff, 0)}% above typical` : `${fmt(Math.abs(diff), 0)}% below typical`,
  };
}

function latestDailyFlow() {
  return state.history.daily
    .filter((d) => d.flowCfs !== null)
    .at(-1);
}

function latestYear() {
  return yearOf(state.history.daily.at(-1).date);
}

function styleWeather(weather) {
  document.body.classList.remove("weather-cloudy", "weather-rain", "weather-hot", "weather-cold");
  if (!weather) return;
  const code = weather.weather_code;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) {
    document.body.classList.add("weather-rain");
  } else if (weather.temperature_2m >= 80) {
    document.body.classList.add("weather-hot");
  } else if (weather.temperature_2m <= 45) {
    document.body.classList.add("weather-cold");
  } else if (weather.cloud_cover >= 72 || code === 3 || code === 45 || code === 48) {
    document.body.classList.add("weather-cloudy");
  }
}

function weatherCodeLabel(code) {
  const labels = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy showers",
    95: "Thunderstorms",
    96: "Thunderstorms",
    99: "Thunderstorms",
  };
  return labels[code] ?? "Conditions";
}

function readableCharacteristic(value) {
  return value
    .replace("Temperature, water", "Water temperature")
    .replace("Depth, Secchi disk depth", "Secchi clarity")
    .replace("Dissolved oxygen (DO)", "Dissolved oxygen")
    .replace("Dissolved oxygen saturation", "Oxygen saturation")
    .replace("Specific conductance", "Conductivity")
    .replace("Total Phosphorus, mixed forms", "Total phosphorus");
}

function formatSample(sample) {
  if (sample.characteristic === "Temperature, water") {
    return `${fmt(sample.valueF, 1)}${DEG}F`;
  }
  if (sample.characteristic === "Depth, Secchi disk depth") {
    return `${fmt(sample.valueFt, 1)} ft`;
  }
  if (sample.characteristic === "pH") {
    return fmt(sample.value, 1);
  }
  return `${fmt(sample.value, sample.value < 1 ? 3 : 1)} ${sample.unit ?? ""}`.trim();
}

function deltaText(delta, unit) {
  if (delta === null || !Number.isFinite(delta)) return "24h change --";
  if (Math.abs(delta) < 0.005) return `flat 24h`;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${fmt(delta, unit === "ft" ? 2 : 1)} ${unit} 24h`;
}

function setText(el, text) {
  if (el) el.textContent = text;
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function signed(value, digits = 0) {
  if (!Number.isFinite(value)) return "--";
  return `${value > 0 ? "+" : ""}${fmt(value, digits)}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateShort(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function shortTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function timeOnly(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function compass(degrees) {
  if (!Number.isFinite(Number(degrees))) return "--";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(Number(degrees) / 45) % 8];
}

function yearOf(date) {
  return Number(String(date).slice(0, 4));
}

function dayOfYear(date) {
  const [year, month, day] = date.split("-").map(Number);
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86400000) + 1;
}

function extent(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  let min = Math.min(...clean);
  let max = Math.max(...clean);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

function scale(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return (outMin + outMax) / 2;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function quantile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function mean(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return NaN;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function percentile(values, value) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length || !Number.isFinite(value)) return NaN;
  const below = clean.filter((v) => v <= value).length;
  return (below / clean.length) * 100;
}

function correlation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  const x = xs.slice(0, n);
  const y = ys.slice(0, n);
  const mx = mean(x);
  const my = mean(y);
  let numerator = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const xv = x[i] - mx;
    const yv = y[i] - my;
    numerator += xv * yv;
    dx += xv * xv;
    dy += yv * yv;
  }
  return numerator / Math.sqrt(dx * dy);
}

function maxBy(items, fn) {
  return items.reduce((best, item) => (fn(item) > fn(best) ? item : best), items[0]);
}

function minBy(items, fn) {
  return items.reduce((best, item) => (fn(item) < fn(best) ? item : best), items[0]);
}

function groupBy(items, fn) {
  const map = new Map();
  for (const item of items) {
    const key = fn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return Array.from(map.values());
}

function thin(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % step === 0);
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}
