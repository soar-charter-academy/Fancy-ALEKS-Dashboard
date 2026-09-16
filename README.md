# ALEKS Weekly Dashboard

Local dashboard for SOAR Charter Academy's weekly ALEKS Usage Report. Tracks, per class (teacher roster):

1. **Compliance %** &mdash; students who met their grade-band weekly minute requirement (K-2: 30 min, 3-8: 45 min)
2. **Top learner** &mdash; student(s) with the most topics learned that week
3. **Most improved class** &mdash; week-over-week growth in usage time and topics learned

Runs entirely on your machine. No student data leaves this folder.

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

## Notes

- `data/incoming` and `data/processed` are git-ignored &mdash; this data identifies real students and should never be committed or pushed anywhere.
- If a class's grade label isn't recognized, the server logs a warning and defaults that class to the 3rd-8th grade threshold (45 min/week) until `lib/gradeThresholds.js` is updated with the correct mapping.
