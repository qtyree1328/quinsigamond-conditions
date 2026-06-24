Report digest: DONE.

The annual Lake Quinsigamond water quality reports (2022–2025) have been
digested into a new **Annual reports** page.

Deliverables (all committed):
- `reports.html` / `reports.js` — the new digest page (linked from the main
  dashboard header nav). Cross-year scorecard, four trend charts, per-year
  summary cards, and a report-figure gallery with lightbox.
- `data/reports.json` — merged machine-readable digest (per-year data +
  cross-year trends + scorecard).
- `data/report-gallery.json` + `assets/reports/*.png` — curated report figures.
- `docs/report-digests/*.md` — per-year markdown digests + index/README.

Method: every page of all four PDFs was read (text + figures, via four parallel
per-year agents). Ratings and min/max/peak numbers are transcribed from report
text (high confidence); seasonal chart shapes were read from figures and are
approximate. See `docs/report-digests/README.md` and the "Method & caveats"
section on the page.

Headline cross-year findings:
- Overall: Good (2022) → Good/Fair (2023) → Good/Fair (2024) → Good (2025).
- Beach closures (Regatta Pt): 32 → 63 → 50 → 0 days; 2023 (record-wet) worst.
- Deep-water phosphorus peak rising every year: 0.408 → 0.388 → 0.509 → 0.673 mg/L.
- Dissolved oxygen rated "Fair" every year (summer bottom-water hypoxia); no fish kills.
