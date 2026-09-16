const path = require('path');
const fs = require('fs');
const express = require('express');

const { parseReportFile } = require('./lib/parseReport');
const {
  computeCompliance,
  computeTopLearners,
  computeMostImproved,
  computeTopicsTotals,
  computeClassDetail,
} = require('./lib/metrics');

const PORT = process.env.PORT || 4173;
const TREND_WEEKS = 6; // how many recent weeks feed the per-student trend lines
const INCOMING_DIR = path.join(__dirname, 'data', 'incoming');
const PROCESSED_DIR = path.join(__dirname, 'data', 'processed');
const MANIFEST_PATH = path.join(PROCESSED_DIR, '.ingested-files.json');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function processedFilePath(weekStart) {
  return path.join(PROCESSED_DIR, `${weekStart}.json`);
}

// Tracks which source filenames have already been parsed, so re-running
// ingest doesn't re-parse (and re-log warnings for) files with nothing new.
function loadIngestedFiles() {
  try {
    return new Set(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')));
  } catch {
    return new Set();
  }
}

function saveIngestedFiles(set) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify([...set], null, 2));
}

function listProcessedWeeks() {
  return fs
    .readdirSync(PROCESSED_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('.'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

function loadWeek(weekStart) {
  const raw = fs.readFileSync(processedFilePath(weekStart), 'utf-8');
  return JSON.parse(raw);
}

function daySpan(week) {
  return (new Date(week.weekEnd) - new Date(week.weekStart)) / 86400000 + 1;
}

// Defaults to the most recent *complete* (5-day) week rather than always the
// latest processed one, since the newest week can be a partial one still in
// progress (e.g. a report pulled mid-week) - showing that by default reads
// misleadingly low and doesn't match what "this week" usually means.
function pickDefaultWeek(weeks) {
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (daySpan(loadWeek(weeks[i])) >= 5) return weeks[i];
  }
  return weeks[weeks.length - 1];
}

app.get('/api/weeks', (req, res) => {
  res.json({ weeks: listProcessedWeeks() });
});

app.post('/api/ingest', (req, res) => {
  const files = fs.readdirSync(INCOMING_DIR).filter((f) => /\.xlsx?$/i.test(f));
  const ingestedFiles = loadIngestedFiles();
  const results = [];

  for (const file of files) {
    if (ingestedFiles.has(file)) {
      results.push({ file, status: 'skipped (already ingested)' });
      continue;
    }

    const fullPath = path.join(INCOMING_DIR, file);
    try {
      const weeks = parseReportFile(fullPath); // a file may contain one or many weeks
      const weekResults = weeks.map((week) => {
        const outPath = processedFilePath(week.weekStart);
        if (fs.existsSync(outPath)) {
          return { weekStart: week.weekStart, status: 'skipped (already processed)' };
        }
        fs.writeFileSync(outPath, JSON.stringify(week, null, 2));
        return { weekStart: week.weekStart, status: 'processed' };
      });
      ingestedFiles.add(file);
      results.push({ file, weeks: weekResults });
    } catch (err) {
      results.push({ file, status: 'error', message: err.message });
    }
  }

  saveIngestedFiles(ingestedFiles);
  res.json({ results });
});

app.get('/api/summary', (req, res) => {
  const weeks = listProcessedWeeks();
  if (weeks.length === 0) {
    return res.status(404).json({ error: 'No processed weeks yet. Drop a report in data/incoming and POST /api/ingest.' });
  }

  const weekStart = req.query.week || pickDefaultWeek(weeks);
  if (!weeks.includes(weekStart)) {
    return res.status(404).json({ error: `No processed data for week ${weekStart}`, availableWeeks: weeks });
  }

  const currentWeek = loadWeek(weekStart);
  const priorWeeks = weeks.filter((w) => w < weekStart);
  const previousWeek = priorWeeks.length > 0 ? loadWeek(priorWeeks[priorWeeks.length - 1]) : null;

  res.json({
    weekStart: currentWeek.weekStart,
    weekEnd: currentWeek.weekEnd,
    availableWeeks: weeks,
    compliance: computeCompliance(currentWeek),
    topLearners: computeTopLearners(currentWeek),
    mostImproved: computeMostImproved(currentWeek, previousWeek),
    topicsTotals: computeTopicsTotals(currentWeek),
  });
});

app.get('/api/class-detail', (req, res) => {
  const { week: weekStart, class: className } = req.query;
  if (!weekStart || !className) {
    return res.status(400).json({ error: 'Both "week" and "class" query params are required' });
  }

  const weeks = listProcessedWeeks();
  const idx = weeks.indexOf(weekStart);
  if (idx === -1) {
    return res.status(404).json({ error: `No processed data for week ${weekStart}` });
  }

  const windowWeeks = weeks.slice(Math.max(0, idx - TREND_WEEKS + 1), idx + 1).map(loadWeek);
  const detail = computeClassDetail(windowWeeks, className);
  if (!detail) {
    return res.status(404).json({ error: `Class "${className}" not found in week ${weekStart}` });
  }

  res.json(detail);
});

app.listen(PORT, () => {
  console.log(`ALEKS dashboard running at http://localhost:${PORT}`);
});
