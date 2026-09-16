const XLSX = require('xlsx');
const { resolveThreshold } = require('./gradeThresholds');

const HEADER_ROW = 8; // 1-indexed "Student Name | Class Grade | ..." row
const DATA_START_ROW = 10; // 1-indexed, first student row

// ALEKS prints a literal "-" for a period with zero recorded activity.
// It's a known, expected sentinel - not a format we failed to recognize.
const NO_ACTIVITY_MARKER = '-';

/**
 * Converts a raw report cell into a minute count.
 * Handles "H:MM:SS" / "H:MM" text, Excel day-fraction numbers (0-1),
 * plain numeric minutes, and the "-" no-activity marker.
 * Logs a warning only when the format truly can't be identified.
 */
function parseDurationToMinutes(value, context) {
  if (value === null || value === undefined || value === '' || value === NO_ACTIVITY_MARKER) return 0;

  if (typeof value === 'number') {
    if (value === 0) return 0;
    if (value > 0 && value < 1) {
      // Excel stores durations formatted as time as a fraction of a 24h day.
      return Math.round(value * 24 * 60);
    }
    // Otherwise assume the export already gives whole minutes.
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const hms = trimmed.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (hms) {
      const hours = Number(hms[1]);
      const minutes = Number(hms[2]);
      const seconds = hms[3] ? Number(hms[3]) : 0;
      return Math.round(hours * 60 + minutes + seconds / 60);
    }
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) return Math.round(asNumber);
  }

  console.warn(`[parseReport] Unrecognized duration value ${JSON.stringify(value)} at ${context} - treating as 0`);
  return 0;
}

function parseTopicsLearned(value, context) {
  if (value === null || value === undefined || value === '' || value === NO_ACTIVITY_MARKER) return 0;
  const num = Number(value);
  if (!Number.isNaN(num)) return Math.round(num);
  console.warn(`[parseReport] Unrecognized "topics learned" value ${JSON.stringify(value)} at ${context} - treating as 0`);
  return 0;
}

function parseProgressPct(value) {
  if (value === null || value === undefined || value === '' || value === NO_ACTIVITY_MARKER) return 0;
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  // Some exports store percentages as a 0-1 fraction rather than 0-100.
  return num > 0 && num <= 1 ? Math.round(num * 1000) / 10 : Math.round(num * 10) / 10;
}

/**
 * The report's header row (row 8) carries one label like "Week Total",
 * "Month Total", or "Total Time" per two-column group (Time, then Learned),
 * with the group's own date range baked into the same cell, e.g.
 * "Week Total\n08/24/2026 - 08/28/2026". A report can contain anywhere from
 * one such "Week Total" group (a single-week export) to several (a
 * multi-week date-range export) - so column positions can't be hard-coded
 * and must be discovered from this row instead.
 */
function findColumnGroups(headerRow) {
  const groups = [];
  const labelPattern = /^(Week Total|Month Total|Total Time)[\s\S]*?(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/;

  headerRow.forEach((cell, col) => {
    if (typeof cell !== 'string') return;
    const match = cell.match(labelPattern);
    if (!match) return;
    const [, label, m1, d1, y1, m2, d2, y2] = match;
    groups.push({
      label,
      timeCol: col,
      learnedCol: col + 1,
      rangeStart: `${y1}-${m1}-${d1}`,
      rangeEnd: `${y2}-${m2}-${d2}`,
    });
  });

  return groups;
}

/**
 * Parses one ALEKS Usage Report .xlsx file into one normalized week object
 * per "Week Total" group found in it (usually one, but a multi-week
 * date-range export contains several).
 * @param {string} filePath
 * @returns {Array<{weekStart: string, weekEnd: string, classes: object}>}
 */
function parseReportFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const [headerRow] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    range: HEADER_ROW - 1,
  });
  const weekGroups = findColumnGroups(headerRow).filter((g) => g.label === 'Week Total');
  if (weekGroups.length === 0) {
    throw new Error('No "Week Total" column found in the report header - unrecognized report layout');
  }

  const dataRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    range: DATA_START_ROW - 1,
  });

  return weekGroups.map((group) => {
    const classes = {};

    dataRows.forEach((row, idx) => {
      const [studentName, gradeLabel, instructor] = row;
      if (!studentName || !instructor) return; // skip any stray blank rows

      const rowContext = `row ${DATA_START_ROW + idx}, week ${group.rangeStart}`;
      if (!classes[instructor]) {
        const { thresholdMinutes } = resolveThreshold(gradeLabel);
        classes[instructor] = {
          gradeBand: gradeLabel || 'Unknown',
          thresholdMinutes,
          students: [],
        };
      }

      classes[instructor].students.push({
        name: studentName,
        weekMinutes: parseDurationToMinutes(row[group.timeCol], `${rowContext} time`),
        weekTopicsLearned: parseTopicsLearned(row[group.learnedCol], `${rowContext} learned`),
      });
    });

    return { weekStart: group.rangeStart, weekEnd: group.rangeEnd, classes };
  });
}

module.exports = { parseReportFile, parseDurationToMinutes, parseTopicsLearned, parseProgressPct };
