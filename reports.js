"use strict";

const COLORS = {
  ink: "#17201d",
  muted: "#63706b",
  water: "#137d91",
  waterDark: "#0e5667",
  leaf: "#517a4b",
  sun: "#f3b44b",
  coral: "#d9694f",
  rain: "#5b85c7",
};

const RATING_META = {
  excellent: { cls: "rate-excellent", color: "#1f7a4d", label: "Excellent" },
  good: { cls: "rate-good", color: "#4e9d6b", label: "Good" },
  "good/fair": { cls: "rate-goodfair", color: "#b6953a", label: "Good/Fair" },
  fair: { cls: "rate-fair", color: "#d98b2b", label: "Fair" },
  poor: { cls: "rate-poor", color: "#cc5337", label: "Poor" },
};

const state = { data: null, gallery: [], explainers: null };

// Order the glossary the way a resident reads the lake, not alphabetically.
const GLOSSARY_ORDER = [
  "beachBacteria",
  "cyanobacteria",
  "waterClarity",
  "dissolvedOxygen",
  "totalPhosphorus",
  "waterTemperature",
  "pH",
  "chlorophyllA",
  "turbidity",
  "specificConductance",
  "nitrate",
  "riverFlow",
];

const DIRECTION_LABEL = {
  higher: "Higher is better",
  lower: "Lower is better",
  "in-range": "Best within a range",
};

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", debounce(drawAllCharts, 140));

async function init() {
  try {
    const [data, gallery, explainers] = await Promise.all([
      fetchJson("data/reports.json"),
      fetchJson("data/report-gallery.json").catch(() => []),
      fetchJson("data/explainers.json").catch(() => null),
    ]);
    state.data = data;
    state.gallery = gallery;
    state.explainers = explainers;
  } catch (error) {
    document.getElementById("reportIntro").textContent =
      "Could not load the report digest data. Run from a local server (see README).";
    console.error(error);
    return;
  }
  renderStateChips();
  renderScorecard();
  renderGlossary();
  renderYearCards();
  renderGallery();
  renderMethod();
  renderLinks();
  drawAllCharts();
  setupLightbox();
}

/* ---------- rating helpers ---------- */

function ratingMeta(value) {
  if (!value) return { cls: "rate-na", color: "#b4bdb7", label: "Not rated" };
  return RATING_META[value.trim().toLowerCase()] || { cls: "rate-na", color: "#b4bdb7", label: value };
}

function ratingDisplay(value) {
  return value ? value : "NR";
}

/* ---------- header / hero ---------- */

function renderStateChips() {
  const host = document.getElementById("stateChips");
  host.replaceChildren();
  for (const entry of state.data.trends.overallState) {
    const meta = ratingMeta(entry.value);
    const chip = document.createElement("div");
    chip.className = "state-chip";
    chip.style.borderLeftColor = meta.color;
    chip.innerHTML = `<b>${entry.year}</b><strong>${entry.value ?? "—"}</strong>`;
    host.append(chip);
  }
}

/* ---------- scorecard matrix ---------- */

function renderScorecard() {
  const host = document.getElementById("scorecard");
  const years = state.data.meta.years;
  host.style.setProperty("--cols", String(years.length));
  host.replaceChildren();

  const head = document.createElement("div");
  head.className = "scorecard-row is-head";
  head.style.setProperty("--cols", String(years.length));
  head.append(cell("scorecard-label", "Parameter"));
  for (const y of years) head.append(cell("scorecard-cell", String(y)));
  host.append(head);

  for (const row of state.data.scorecard) {
    const r = document.createElement("div");
    r.className = "scorecard-row" + (row.key === "overall" ? " is-overall" : "");
    r.style.setProperty("--cols", String(years.length));
    r.append(cell("scorecard-label", row.label));
    for (const v of row.values) {
      const meta = ratingMeta(v.rating);
      const c = cell(`scorecard-cell ${meta.cls}`, ratingDisplay(v.rating));
      c.title = `${row.label} ${v.year}: ${v.rating ?? "Not rated"}`;
      r.append(c);
    }
    host.append(r);
  }

  const key = document.getElementById("ratingKey");
  key.replaceChildren();
  for (const k of ["excellent", "good", "good/fair", "fair", "poor"]) {
    const m = RATING_META[k];
    const span = document.createElement("span");
    span.innerHTML = `<i style="background:${m.color}"></i>${m.label}`;
    key.append(span);
  }
  const na = document.createElement("span");
  na.innerHTML = `<i style="background:#b4bdb7"></i>NR = not separately rated that year`;
  key.append(na);
}

function cell(cls, text) {
  const el = document.createElement("div");
  el.className = cls;
  el.textContent = text;
  return el;
}

/* ---------- glossary ---------- */

function renderGlossary() {
  const host = document.getElementById("glossary");
  if (!host) return;
  if (!state.explainers) {
    host.innerHTML = `<p class="section-sub">Glossary unavailable.</p>`;
    return;
  }
  host.replaceChildren();
  const keys = GLOSSARY_ORDER.filter((k) => state.explainers[k]);
  for (const key of keys) {
    const e = state.explainers[key];
    const card = document.createElement("details");
    card.className = "glossary-card";

    const bands = (e.bands || [])
      .map(
        (b) =>
          `<li><span class="band-label">${escapeHtml(b.label)}</span><span class="band-range">${escapeHtml(b.range)}</span>${b.note ? `<span class="band-note">${escapeHtml(b.note)}</span>` : ""}</li>`,
      )
      .join("");

    card.innerHTML = `
      <summary class="glossary-summary">
        <span class="glossary-term">${escapeHtml(e.term)}</span>
        <span class="glossary-dir">${DIRECTION_LABEL[e.goodDirection] || ""}</span>
      </summary>
      <div class="glossary-body">
        <p>${escapeHtml(e.plain)}</p>
        <p class="glossary-why">${escapeHtml(e.why)}</p>
        <p class="glossary-normal"><b>Normal:</b> ${escapeHtml(e.normal)}</p>
        ${bands ? `<ul class="band-list">${bands}</ul>` : ""}
        <p class="glossary-source">Source: ${escapeHtml(e.source)}</p>
      </div>`;
    host.append(card);
  }
}

/* ---------- year cards ---------- */

function renderYearCards() {
  const host = document.getElementById("yearCards");
  host.replaceChildren();
  for (const y of state.data.meta.years) {
    const d = state.data.years[String(y)];
    const meta = ratingMeta(d.overallState);
    const card = document.createElement("article");
    card.className = "year-card";
    card.style.borderTopColor = meta.color;

    const rp = d.beaches.regattaPoint;
    const lp = d.beaches.lakePark;
    const tp = d.metrics.totalPhosphorus;
    const secchi = d.metrics.secchiClarityFt;

    const stats = [
      stat("Regatta Pt. closures", fmtDays(rp.daysClosed), `${rp.timesTested ?? "—"} tests`),
      stat("Lake Park closures", fmtDays(lp.daysClosed), `${lp.timesTested ?? "—"} tests`),
      stat("Clarity (Secchi)", secchi.min != null ? `${secchi.min}–${secchi.max} ft` : "—", "range"),
      stat("Deep TP peak", tp.peak != null ? `${tp.peak} mg/L` : "—", "southern bottom"),
    ].join("");

    const findings = (d.keyFindings || [])
      .slice(0, 4)
      .map((f) => `<li>${escapeHtml(f)}</li>`)
      .join("");

    const events = (d.events || [])
      .slice(0, 3)
      .map((e) => `<li>${escapeHtml(e.name)}${e.date ? ` <small>(${escapeHtml(shortDate(e.date))})</small>` : ""}</li>`)
      .join("");

    card.innerHTML = `
      <div class="year-card-head">
        <h3>${y}</h3>
        <span class="year-card-state" style="background:${meta.color}">${d.overallState}</span>
      </div>
      <p class="year-card-summary">${escapeHtml(d.summary)}</p>
      <div class="year-stats">${stats}</div>
      <ul class="year-findings">${findings}</ul>
      ${events ? `<p class="year-events-title">Notable events</p><ul class="year-findings">${events}</ul>` : ""}
    `;
    host.append(card);
  }
}

function stat(label, value, sub) {
  return `<div class="year-stat"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
}

function fmtDays(n) {
  if (n == null) return "—";
  if (n === 0) return "None";
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/* ---------- gallery + lightbox ---------- */

function renderGallery() {
  const host = document.getElementById("gallery");
  host.replaceChildren();
  if (!state.gallery.length) {
    host.innerHTML = `<p class="section-sub">Report figures unavailable.</p>`;
    return;
  }
  for (const item of state.gallery) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gallery-item";
    btn.innerHTML = `
      <img class="gallery-thumb" src="${item.file}" alt="Figure from the ${item.year} report, page ${item.page}" loading="lazy">
      <div class="gallery-meta">
        <b>${item.year} · page ${item.page}</b>
        <p>${escapeHtml(item.caption)}</p>
      </div>`;
    btn.addEventListener("click", () => openLightbox(item));
    host.append(btn);
  }
}

function setupLightbox() {
  const box = document.getElementById("lightbox");
  const close = () => {
    box.hidden = true;
    document.getElementById("lightboxImg").src = "";
  };
  document.getElementById("lightboxClose").addEventListener("click", close);
  box.addEventListener("click", (e) => {
    if (e.target === box) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !box.hidden) close();
  });
}

function openLightbox(item) {
  const box = document.getElementById("lightbox");
  document.getElementById("lightboxImg").src = item.file;
  document.getElementById("lightboxImg").alt = `Figure from the ${item.year} report, page ${item.page}`;
  document.getElementById("lightboxCaption").textContent = `${item.year} report, page ${item.page} — ${item.caption}`;
  box.hidden = false;
}

/* ---------- method + sources ---------- */

function renderMethod() {
  const host = document.getElementById("methodBody");
  const allCaveats = [];
  for (const y of state.data.meta.years) {
    for (const c of state.data.years[String(y)].caveats || []) allCaveats.push({ y, c });
  }
  const highlighted = allCaveats
    .filter(({ c }) => /Indian Lake|cells\/mL|PFAS|approximate|approximated|mislabel/i.test(c))
    .slice(0, 6)
    .map(({ y, c }) => `<li><b>${y}:</b> ${escapeHtml(c)}</li>`)
    .join("");

  host.innerHTML = `
    <p>${escapeHtml(state.data.meta.note)}</p>
    <h3>Confidence</h3>
    <ul>
      <li><b>High confidence</b> — State of the Lake ratings, beach closure counts, and the minimum / maximum / peak values shown in the cards and scorecard are transcribed directly from the report text and tables.</li>
      <li><b>Approximate</b> — seasonal chart shapes were read from the report figures with vision and are not exact. Where a report states a number, that number is preferred.</li>
    </ul>
    <h3>Notable caveats flagged in the source reports</h3>
    <ul>${highlighted}</ul>
  `;
}

function renderLinks() {
  const host = document.getElementById("reportLinks");
  host.replaceChildren();
  for (const y of state.data.meta.years) {
    const a = document.createElement("a");
    a.href = `Reports/water-quality-report-${y}-lake-quinsigamond.pdf`;
    a.textContent = `${y} report (PDF)`;
    host.append(a);
  }
  const src = document.createElement("a");
  src.href = "https://www.worcesterma.gov/";
  src.target = "_blank";
  src.rel = "noopener";
  src.textContent = "City of Worcester Lakes & Ponds";
  host.append(src);
}

/* ---------- charts ---------- */

function drawAllCharts() {
  if (!state.data) return;
  drawBeachChart();
  drawTpChart();
  drawSecchiChart();
  drawTempChart();
}

function drawBeachChart() {
  const canvas = document.getElementById("beachChart");
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;
  const plot = plotBox(canvas);
  const years = state.data.meta.years;
  const regatta = state.data.trends.beachClosureDays.regattaPoint;
  const lake = state.data.trends.beachClosureDays.lakePark;
  const max = Math.max(10, ...regatta.map((d) => d.value ?? 0), ...lake.map((d) => d.value ?? 0));
  drawGrid(ctx, plot);
  drawYTicks(ctx, plot, max, (v) => String(Math.round(v)));

  const groupW = plot.width / years.length;
  const barW = Math.min(34, groupW * 0.32);
  years.forEach((y, i) => {
    const cx = plot.left + groupW * (i + 0.5);
    const rv = regatta[i].value ?? 0;
    const lv = lake[i].value ?? 0;
    bar(ctx, cx - barW - 3, rv, max, plot, barW, COLORS.water);
    bar(ctx, cx + 3, lv, max, plot, barW, COLORS.sun);
    label(ctx, cx, plot.bottom + 16, String(y));
  });
  setLegend("beachLegend", [
    ["Regatta Point", COLORS.water],
    ["Lake Park", COLORS.sun],
  ]);
  document.getElementById("beachStat").textContent =
    `Regatta Point: ${regatta[0].value}→${regatta.at(-1).value} days · 2023 was the worst year`;
}

function bar(ctx, x, value, max, plot, w, color) {
  const h = (value / max) * plot.height;
  const y = plot.bottom - h;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (value > 0) {
    ctx.fillStyle = COLORS.ink;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(value), x + w / 2, y - 5);
  }
}

function drawTpChart() {
  const canvas = document.getElementById("tpChart");
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;
  const plot = plotBox(canvas);
  const years = state.data.meta.years;
  const series = state.data.trends.southBottomTpPeak;
  const values = series.map((d) => d.value);
  const max = Math.max(...values) * 1.18;
  drawGrid(ctx, plot);
  drawYTicks(ctx, plot, max, (v) => v.toFixed(2));

  const x = (i) => plot.left + (plot.width / (years.length - 1)) * i;
  const y = (v) => plot.bottom - (v / max) * plot.height;

  // area fill
  ctx.beginPath();
  ctx.moveTo(x(0), plot.bottom);
  values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(values.length - 1), plot.bottom);
  ctx.closePath();
  ctx.fillStyle = "rgba(204, 83, 55, 0.12)";
  ctx.fill();

  drawLinePts(ctx, values.map((v, i) => [x(i), y(v)]), COLORS.coral, 2.5);
  values.forEach((v, i) => {
    dot(ctx, x(i), y(v), COLORS.coral);
    ctx.fillStyle = COLORS.ink;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(v.toFixed(3), x(i), y(v) - 10);
    label(ctx, x(i), plot.bottom + 16, String(years[i]));
  });
  setLegend("tpLegend", [["Peak bottom phosphorus (Southern site)", COLORS.coral]]);
  document.getElementById("tpStat").textContent =
    `${values[0]}→${values.at(-1)} mg/L · +${Math.round(((values.at(-1) - values[0]) / values[0]) * 100)}% since 2022`;
}

function drawSecchiChart() {
  const canvas = document.getElementById("secchiChart");
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;
  const plot = plotBox(canvas);
  const years = state.data.meta.years;
  const series = state.data.trends.secchiRangeFt;
  const max = Math.max(...series.map((d) => d.max)) * 1.1;
  drawGrid(ctx, plot);
  drawYTicks(ctx, plot, max, (v) => Math.round(v) + "'");

  const groupW = plot.width / years.length;
  const barW = Math.min(30, groupW * 0.34);
  const y = (v) => plot.bottom - (v / max) * plot.height;
  years.forEach((yr, i) => {
    const cx = plot.left + groupW * (i + 0.5);
    const d = series[i];
    ctx.fillStyle = "rgba(19, 125, 145, 0.78)";
    ctx.fillRect(cx - barW / 2, y(d.max), barW, y(d.min) - y(d.max));
    ctx.fillStyle = COLORS.ink;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${d.max}`, cx, y(d.max) - 5);
    ctx.fillText(`${d.min}`, cx, y(d.min) + 14);
    label(ctx, cx, plot.bottom + 16, String(yr));
  });
  setLegend("secchiLegend", [["Secchi clarity min–max (ft)", "rgba(19, 125, 145, 0.78)"]]);
  document.getElementById("secchiStat").textContent = "Higher = clearer water";
}

function drawTempChart() {
  const canvas = document.getElementById("tempChart");
  const ctx = prepareCanvas(canvas);
  if (!ctx) return;
  const plot = plotBox(canvas);
  const years = state.data.meta.years;
  const series = state.data.trends.maxSurfaceTempC;
  const values = series.map((d) => d.value);
  const min = Math.min(...values) - 1.2;
  const max = Math.max(...values) + 0.8;
  drawGrid(ctx, plot);
  drawYTicks(ctx, plot, max, (v) => v.toFixed(0) + "°", min);

  const x = (i) => plot.left + (plot.width / (years.length - 1)) * i;
  const y = (v) => plot.bottom - ((v - min) / (max - min)) * plot.height;
  drawLinePts(ctx, values.map((v, i) => [x(i), y(v)]), COLORS.coral, 2.5);
  values.forEach((v, i) => {
    dot(ctx, x(i), y(v), COLORS.coral);
    ctx.fillStyle = COLORS.ink;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${v}°C`, x(i), y(v) - 10);
    label(ctx, x(i), plot.bottom + 16, String(years[i]));
  });
  setLegend("tempLegend", [["Peak surface temperature (°C)", COLORS.coral]]);
  document.getElementById("tempStat").textContent =
    `${Math.min(...values)}–${Math.max(...values)} °C peak`;
}

/* ---------- canvas helpers ---------- */

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
  canvas.cssWidth = rect.width;
  canvas.cssHeight = rect.height;
  return ctx;
}

function plotBox(canvas) {
  const width = canvas.cssWidth ?? canvas.getBoundingClientRect().width;
  const height = canvas.cssHeight ?? canvas.getBoundingClientRect().height;
  return {
    left: 50,
    top: 22,
    right: width - 16,
    bottom: height - 34,
    width: width - 66,
    height: height - 56,
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

function drawYTicks(ctx, plot, max, fmtFn, min = 0) {
  ctx.save();
  ctx.fillStyle = COLORS.muted;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const frac = i / 4;
    const value = min + (max - min) * (1 - frac);
    const y = plot.top + plot.height * frac;
    ctx.fillText(fmtFn(value), plot.left - 8, y + 4);
  }
  ctx.restore();
}

function drawLinePts(ctx, pts, color, width = 2) {
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

function dot(ctx, x, y, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function label(ctx, x, y, text) {
  ctx.save();
  ctx.fillStyle = COLORS.muted;
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function setLegend(id, items) {
  const container = document.getElementById(id);
  container.replaceChildren();
  for (const [text, color] of items) {
    const entry = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.style.background = color;
    entry.append(swatch, document.createTextNode(text));
    container.append(entry);
  }
}

/* ---------- utilities ---------- */

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function shortDate(value) {
  return String(value).replace(/-\d{2}$/, "").replace(/^(\d{4})-(\d{2})$/, (_, y, m) => {
    const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[+m]} ${y}`;
  });
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
