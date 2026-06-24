# Lake Quinsigamond Report Digest — Progress Log

**Goal:** Full, exhaustive, public-health-grade digest of every annual Worcester
"Lake Quinsigamond Water Quality Report" (2022–2025). Extract text + figures,
build cross-year historical trend charts, summarize main findings per year, and
make the figure/graph data comparable across years.

Last updated: 2026-06-24

---

## Inputs found in repo
- `Reports/water-quality-report-2022-lake-quinsigamond.pdf` — 27 pages
- `Reports/water-quality-report-2023-lake-quinsigamond.pdf` — 20 pages
- `Reports/water-quality-report-2024-lake-quinsigamond.pdf` — 25 pages
- `Reports/water-quality-report-2025-lake-quinsigamond.pdf` — 22 pages

Existing project context: this repo is a static "Lake Quinsigamond Conditions"
dashboard (`index.html`, `app.js`, `data/`, `scripts/`). The digest is intended
as a new section/page that complements it. (No final decision yet on exactly how
to integrate — see Open Questions.)

## Tooling confirmed available
`pdftotext`, `pdftoppm`, `pdfimages` (poppler, via MacPorts `/opt/local/bin`),
`node` (v22), `python3`, `jq`.

---

## DONE
1. **Inspected repo + PDFs.** All 4 reports follow the same structure: Background,
   Water Quality Summary, per-parameter sections (Fecal Bacteria, Water Clarity,
   Temperature/Stratification, Dissolved Oxygen, pH, Nutrients, Cyanobacteria,
   Tributaries, Invasive Species, Industrial Contaminants every ~3 yrs, Litter),
   Urban Disturbances/events, Ongoing Projects, State of the Lake, Plan for next year,
   depth-profile appendices. Each parameter gets an L&P rating:
   Excellent / Good / Fair / Poor.
2. **Extracted layout text** for all 4 years →
   `<SCRATCHPAD>/text-2022.txt` ... `text-2025.txt`. Quality is excellent.
3. **Rendered every page to PNG** at 120 dpi →
   `<SCRATCHPAD>/pages-2022/p-01.png` ... per year. (27/20/25/22 pages.)
4. **Determined figure strategy.** `pdfimages -list` shows the seasonal data charts
   are *vector-drawn*, NOT embedded raster images (embedded images are just small
   flag icons, photos, maps). So clean chart images can't be pulled directly. Plan:
   read the chart data with vision from the page PNGs and REBUILD clean,
   consistent, cross-year-comparable charts; also crop figures from page renders for
   a visual gallery.
5. **Read the full 2022 text** end-to-end (representative of structure).
6. **Wrote a shared extraction schema** → `<SCRATCHPAD>/SCHEMA.md`. Defines the exact
   JSON shape every per-year agent must output so results merge cleanly:
   `digest-<YEAR>.json` (ratings, metrics with min/max/avg + units, beaches,
   cyanobacteria, tributaries, invasives, contaminants, events, management, plans,
   key findings, caveats) and `figures-<YEAR>.json` (transcribed chart series:
   parameter, site, units, rating bands, (date,value) points, confidence).

`<SCRATCHPAD>` =
`/private/tmp/claude-501/-Users-qtyree-Desktop-Desktop-Files-Life-Lake/e69842ae-7eb1-48e8-9306-58584a097a7c/scratchpad`

> Note: the scratchpad is **session-temporary**. The extracted text, page PNGs, and
> SCHEMA.md live there. If the session is lost, re-run steps 2–3 (commands below) and
> SCHEMA.md content is reproduced in this repo's git/this doc context. Consider moving
> durable artifacts into the repo (see Open Questions).

## INTERRUPTED / NOT YET DONE
- **Was about to launch 4 parallel deep-digest agents** (one per year) to read
  text + page PNGs and emit `digest-<YEAR>.json` + `figures-<YEAR>.json` per SCHEMA.md,
  each returning a 150–250-word public summary. **User paused before they ran — they
  did NOT run.** No agent output exists yet.
- Crop figures into a cross-year comparison gallery — not started.
- Merge per-year JSON into a single `reports.json`; reconcile ratings/stats — not started.
- Build the digest dashboard (cross-year trend charts, scorecard matrix, per-year
  summaries, figure gallery) — not started.
- Write per-year markdown digests + verify against source PDFs — not started.

## Reproduce the prep steps (if scratchpad is gone)
```sh
cd Reports
WORK=<scratchpad-or-any-tmp>
for y in 2022 2023 2024 2025; do
  f="water-quality-report-$y-lake-quinsigamond.pdf"
  pdftotext -layout "$f" "$WORK/text-$y.txt"
  mkdir -p "$WORK/pages-$y"; pdftoppm -png -r 120 "$f" "$WORK/pages-$y/p"
done
```

## Open questions for the user
1. **Deliverable form & location:** A standalone `digest/index.html` page (cross-year
   charts + scorecard + per-year cards + figure gallery)? Integrate into the existing
   dashboard? Or markdown digests + a data JSON only? (Current assumption: standalone
   HTML digest page + `reports.json` + per-year markdown, kept in the repo.)
2. **Agent fan-out:** OK to use parallel sub-agents to read the figures (4 agents,
   one per year)? That was the step that got paused.
3. **Figure data confidence:** Cross-year trend charts will be built primarily from
   text-stated values (min/max/avg, closure counts, ratings = high confidence), with
   vision-read seasonal series labeled as approximate. Acceptable?
4. **Scope of "every report":** Only these 4 PDFs (2022–2025) exist in the repo. The
   2022 report references a 2017–2021 history and earlier monitoring — pull those in
   if available, or keep to the 4 PDFs on hand?

## Key facts already extracted (2022, as a sample of depth)
- Overall State of the Lake 2022: **Good** (also Good in 2021).
- Beaches: Regatta Point closed **32 days** (4 events, tested 21×); Lake Park **0**
  closures (tested 15×). Fewer closures than 2021.
- Deep-water **hypoxia** after late June; 2 days of "the squeeze" (no cold-water-fish
  habitat) but **no fish kills**.
- Bottom **TP rising**, southern site peak **0.408 mg/l** (>north avg 0.043 vs south 0.166).
- **PFAS** total regulated 13.3 / 16.13 ng/l — below 20 ng/l drinking-water MCL.
- Two major events: **Lake Ave sewage overflow** (5.75 M gal, Feb 6 2022) and
  **Belmont St construction sediment** plumes (TP 4.66 mg/l at outfall).
- Ratings 2022: Fecal=Good, Clarity=Good, Temp=Good, DO=Fair, Cyano=Good.
