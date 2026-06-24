Paused and documented. Progress is saved to docs/report-digest-progress.md.

Where things stand
Done:

Inspected all 4 reports (2022–2025, 20–27 pages each) — they share a consistent structure (per-parameter sections each rated Excellent/Good/Fair/Poor, plus events, invasives, contaminants, depth profiles).
Extracted clean layout text for all 4 years.
Rendered every page to PNG (120 dpi) so figures can be read with vision.
Determined the figure strategy: the seasonal charts are vector-drawn, not extractable as clean images — so the plan is to read their data with vision and rebuild consistent cross-year charts, plus crop a visual gallery.
Read the full 2022 report and wrote a shared extraction schema (SCHEMA.md) so per-year results merge cleanly.
Interrupted: I was about to launch 4 parallel agents (one per year) to read text + figures and emit structured JSON + summaries. You paused before they ran — none executed, so no agent output exists yet.

Not started: figure gallery, merged reports.json, the digest dashboard, per-year markdown digests.

Note: the extracted text/PNGs live in a session-temporary scratchpad. The prep commands to regenerate them are in the progress doc.

Before I resume, two decisions would help
Deliverable — my default plan is a standalone digest/index.html page (cross-year trend charts + a parameter×year scorecard matrix + per-year summary cards + figure gallery), backed by a reports.json and per-year markdown digests, all committed into the repo. Good, or do you want it integrated into the existing dashboard / kept as just markdown + data?
The paused step was the 4-agent fan-out to read the charts. Was the pause because you wanted to redirect the approach, or just to checkpoint? If you're fine with it, I'll re-launch those agents and continue.
How would you like me to proceed?