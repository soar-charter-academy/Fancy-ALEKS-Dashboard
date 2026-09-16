# ALEKS Weekly Dashboard

Local dashboard for SOAR Charter Academy's weekly ALEKS Usage Report. Tracks, per class (teacher roster):

1. **Compliance %** &mdash; students who met their grade-band weekly minute requirement (K-2: 30 min, 3-8: 45 min)
2. **Top learner** &mdash; student(s) with the most topics learned that week
3. **Most improved class** &mdash; week-over-week growth in usage time and topics learned
4. **Per-student drill-down** &mdash; click a class, then a student, for their week-by-week minutes/topics history, trend arrows, and concern flags (2 weeks running under the minute requirement, or in the bottom quartile of the class on topics learned)

No login yet by design &mdash; every viewer sees the same full dashboard. Data currently lives in flat JSON files on disk (see `data/processed/`), generated from whatever `.xlsx` reports have been dropped in `data/incoming/`; this is expected to move to Supabase later.

## Setup

```
npm install
npm start
```

Then open http://localhost:4173

## Adding a new week

1. Export the weekly ALEKS Usage Report as `.xlsx` from ALEKS.
2. Drop the file into `data/incoming/`.
3. In the dashboard, click **Process new reports**.
4. Select the new week from the dropdown.

Already-processed weeks are skipped automatically if you re-run ingest (matched by the date range inside the report), so it's safe to leave old files in `data/incoming/`.

## Running as a shared web app

The server already listens on all network interfaces (`HOST=0.0.0.0` by default) and reads its port from `PORT` (defaults to 4173), so as-is it's reachable by anyone on the same network as the machine it's running on &mdash; e.g. `http://<that-machine's-IP>:4173`. No code changes are needed to put it on an actual host (Render, Railway, Fly.io, a school server, etc.) beyond whatever that platform's deploy step requires; it's a plain `npm install && npm start` Node app with no build step.

**Known gaps for real multi-user / hosted use:**
- **No authentication.** Anyone who can reach the URL sees everything, including student names and performance data. This is intentional for now but should not be exposed on the open internet without adding auth first.
- **Storage is flat JSON files on disk**, fine for one server process but won't survive most hosting platforms' ephemeral filesystems, and has no real concurrency control (two people running "Process new reports" at the exact same moment could race). Planned fix: move to Supabase (owned by Jason) &mdash; at that point `lib/parseReport.js`'s output shape (see the week JSON structure it writes) is the contract to preserve so `lib/metrics.js` and the frontend don't need to change.

## Notes

- `data/incoming` and `data/processed` are git-ignored &mdash; this data identifies real students and should never be committed or pushed anywhere.
- If a class's grade label isn't recognized, the server logs a warning and defaults that class to the 3rd-8th grade threshold (45 min/week) until `lib/gradeThresholds.js` is updated with the correct mapping.
