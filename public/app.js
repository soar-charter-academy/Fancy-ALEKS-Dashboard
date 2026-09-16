const weekSelect = document.getElementById('weekSelect');
const ingestBtn = document.getElementById('ingestBtn');
const ingestStatus = document.getElementById('ingestStatus');
const emptyState = document.getElementById('emptyState');
const dashboard = document.getElementById('dashboard');

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Request to ${url} failed`);
  return body;
}

function fmtMinutes(n) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n} min`;
}

let currentWeekStart = null;
const expandedClasses = new Set();
const expandedStudents = new Set(); // keys: `${className}::${studentName}`
const classDetailCache = new Map(); // key: `${weekStart}::${className}`

// Simple up/down/flat arrow comparing this week to the prior week (the same
// two weeks the concern flags look at), rather than a full trend line.
function trendArrow(history, key) {
  if (history.length < 2) return '<span class="trend-flat" title="Not enough history yet">&#8594;</span>';
  const last = history[history.length - 1][key];
  const prev = history[history.length - 2][key];
  if (last === null || prev === null) return '<span class="trend-flat" title="Not enough history yet">&#8594;</span>';
  if (last > prev) return `<span class="trend-up" title="Up from ${prev} to ${last}">&#8599;</span>`;
  if (last < prev) return `<span class="trend-down" title="Down from ${prev} to ${last}">&#8600;</span>`;
  return `<span class="trend-flat" title="Unchanged at ${last}">&#8594;</span>`;
}

function flagBadge(flags) {
  const reasons = [];
  if (flags.minutesConcern) reasons.push('Missed the minute requirement 2 weeks in a row');
  if (flags.topicsConcern) reasons.push("Bottom quartile of the class's topics learned, 2 weeks in a row");
  if (reasons.length === 0) return '';
  return `<span class="flag" title="${reasons.join(' &#10;')}">&#128681;</span>`;
}

async function loadClassDetail(className) {
  const key = `${currentWeekStart}::${className}`;
  if (!classDetailCache.has(key)) {
    const detail = fetchJSON(`/api/class-detail?week=${encodeURIComponent(currentWeekStart)}&class=${encodeURIComponent(className)}`);
    classDetailCache.set(key, detail);
  }
  return classDetailCache.get(key);
}

function studentKey(className, name) {
  return `${className}::${name}`;
}

// The full week-by-week breakdown for one student, shown when their name is clicked.
function buildStudentDetailRow(student) {
  const tr = document.createElement('tr');
  tr.className = 'student-detail-row';
  const td = document.createElement('td');
  td.colSpan = 5;

  const reasons = [];
  if (student.flags.minutesConcern) reasons.push('Missed the minute requirement 2 weeks in a row');
  if (student.flags.topicsConcern) reasons.push("Bottom quartile of the class's topics learned, 2 weeks in a row");
  const reasonHtml = reasons.length
    ? `<p class="flag-reason">&#128681; ${reasons.join(' &nbsp;&middot;&nbsp; ')}</p>`
    : '';

  const weekRows = student.minutesHistory.map((h, i) => {
    const t = student.topicsHistory[i];
    const metText = h.met === null ? '&mdash;' : h.met ? 'Met' : 'Missed';
    const standingText = t.lowQuartile === null ? '&mdash;' : t.lowQuartile ? 'Bottom quartile' : 'Typical';
    const minutesCellClass = h.met === false ? 'pct-bad' : '';
    return `
      <tr>
        <td>${h.weekStart}</td>
        <td class="${minutesCellClass}">${h.minutes ?? '&mdash;'}</td>
        <td>${metText}</td>
        <td>${t.topics ?? '&mdash;'}</td>
        <td>${standingText}</td>
      </tr>
    `;
  }).join('');

  td.innerHTML = `
    ${reasonHtml}
    <table class="student-history-table">
      <thead><tr><th>Week</th><th>Minutes</th><th>Requirement</th><th>Topics Learned</th><th>Class Standing</th></tr></thead>
      <tbody>${weekRows}</tbody>
    </table>
  `;
  tr.appendChild(td);
  return tr;
}

function toggleStudentDetail(studentRow, student, key) {
  const next = studentRow.nextElementSibling;
  if (next && next.classList.contains('student-detail-row')) {
    next.remove();
  }
  if (expandedStudents.has(key)) {
    studentRow.after(buildStudentDetailRow(student));
  }
}

function renderClassDetailRows(detail) {
  const table = document.createElement('table');
  table.className = 'detail-table';
  table.innerHTML = `
    <thead>
      <tr><th>Student</th><th>Minutes</th><th>Topics Learned</th><th>Minutes Trend</th><th>Topics Trend</th></tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  detail.students
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((s) => {
      const minutesClass = s.weekMinutes !== null && s.weekMinutes < detail.thresholdMinutes ? 'pct-bad' : '';
      const tr = document.createElement('tr');
      tr.className = s.flags.minutesConcern || s.flags.topicsConcern ? 'concern-row' : '';
      tr.innerHTML = `
        <td><button type="button" class="student-link">${flagBadge(s.flags)} ${s.name}</button></td>
        <td class="${minutesClass}">${s.weekMinutes ?? '&mdash;'}</td>
        <td>${s.weekTopicsLearned ?? '&mdash;'}</td>
        <td>${trendArrow(s.minutesHistory, 'minutes')}</td>
        <td>${trendArrow(s.topicsHistory, 'topics')}</td>
      `;
      tbody.appendChild(tr);

      const key = studentKey(detail.className, s.name);
      tr.querySelector('.student-link').addEventListener('click', () => {
        if (expandedStudents.has(key)) expandedStudents.delete(key); else expandedStudents.add(key);
        toggleStudentDetail(tr, s, key);
      });

      if (expandedStudents.has(key)) tbody.appendChild(buildStudentDetailRow(s));
    });

  const wrapperTr = document.createElement('tr');
  wrapperTr.className = 'detail-row';
  const wrapperTd = document.createElement('td');
  wrapperTd.colSpan = 5;
  wrapperTd.appendChild(table);
  wrapperTr.appendChild(wrapperTd);
  return wrapperTr;
}

async function toggleClassRow(className, container) {
  if (expandedClasses.has(className)) {
    expandedClasses.delete(className);
  } else {
    expandedClasses.add(className);
  }
  await renderExpandedRow(className, container);
}

async function renderExpandedRow(className, afterRow) {
  const existing = afterRow.nextElementSibling;
  if (existing && existing.classList.contains('detail-row')) existing.remove();

  if (!expandedClasses.has(className)) return;

  const placeholder = document.createElement('tr');
  placeholder.className = 'detail-row';
  placeholder.innerHTML = '<td colspan="5">Loading student detail&hellip;</td>';
  afterRow.after(placeholder);

  try {
    const detail = await loadClassDetail(className);
    placeholder.replaceWith(renderClassDetailRows(detail));
  } catch (err) {
    placeholder.innerHTML = `<td colspan="5">Error loading detail: ${err.message}</td>`;
  }
}

function renderCompliance(rows) {
  const tbody = document.querySelector('#complianceTable tbody');
  tbody.innerHTML = '';
  rows
    .slice()
    .sort((a, b) => a.compliancePct - b.compliancePct)
    .forEach((r) => {
      const tr = document.createElement('tr');
      const pctClass = r.compliancePct >= 80 ? 'pct-good' : r.compliancePct < 50 ? 'pct-bad' : '';
      tr.innerHTML = `
        <td><button type="button" class="class-link">${r.className}</button></td>
        <td>${r.gradeBand}</td>
        <td>${r.thresholdMinutes} min/week</td>
        <td>${r.studentsMet} / ${r.studentsTotal}</td>
        <td class="${pctClass}">${r.compliancePct}%</td>
      `;
      tbody.appendChild(tr);
      tr.querySelector('.class-link').addEventListener('click', () => toggleClassRow(r.className, tr));
      if (expandedClasses.has(r.className)) renderExpandedRow(r.className, tr);
    });
}

function renderTopLearners(rows) {
  const tbody = document.querySelector('#topLearnerTable tbody');
  tbody.innerHTML = '';
  rows
    .slice()
    .sort((a, b) => b.topics - a.topics)
    .forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.className}</td>
        <td>${r.gradeBand}</td>
        <td>${r.topics}</td>
        <td>${r.students.join(', ') || '&mdash;'}</td>
      `;
      tbody.appendChild(tr);
    });
}

function renderMostImproved(mostImproved) {
  const unavailable = document.getElementById('mostImprovedUnavailable');
  const content = document.getElementById('mostImprovedContent');

  if (!mostImproved.available) {
    unavailable.hidden = false;
    content.hidden = true;
    return;
  }
  unavailable.hidden = true;
  content.hidden = false;

  const usageBody = document.querySelector('#usageGrowthTable tbody');
  usageBody.innerHTML = '';
  mostImproved.byUsage.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.className}</td><td>${fmtMinutes(r.minutesDelta)}</td>`;
    usageBody.appendChild(tr);
  });
}

function renderTopicsTotals(rows) {
  const tbody = document.querySelector('#topicsTotalTable tbody');
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.className}</td><td>${r.topics}</td>`;
    tbody.appendChild(tr);
  });
}

async function loadSummary(weekStart) {
  const url = weekStart ? `/api/summary?week=${encodeURIComponent(weekStart)}` : '/api/summary';
  const summary = await fetchJSON(url);

  emptyState.hidden = true;
  dashboard.hidden = false;

  if (weekSelect.children.length === 0 || weekStart === undefined) {
    populateWeekSelect(summary.availableWeeks, summary.weekStart);
  }

  if (currentWeekStart !== summary.weekStart) {
    expandedClasses.clear(); // expanded detail is week-specific; collapse on week change
    expandedStudents.clear();
  }
  currentWeekStart = summary.weekStart;

  renderWeekBanner(summary.weekStart, summary.weekEnd);
  renderCompliance(summary.compliance);
  renderTopLearners(summary.topLearners);
  renderMostImproved(summary.mostImproved);
  renderTopicsTotals(summary.topicsTotals);
}

function renderWeekBanner(weekStart, weekEnd) {
  const banner = document.getElementById('weekBanner');
  const spanDays = (new Date(weekEnd) - new Date(weekStart)) / 86400000 + 1;
  const isPartial = spanDays < 5;
  banner.textContent = `Showing week of ${weekStart} to ${weekEnd}`
    + (isPartial ? ` (partial week - only ${spanDays} day${spanDays === 1 ? '' : 's'} reported so far)` : '');
  banner.classList.toggle('partial-week', isPartial);
}

function populateWeekSelect(weeks, selected) {
  weekSelect.innerHTML = '';
  weeks
    .slice()
    .sort()
    .reverse()
    .forEach((w) => {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      if (w === selected) opt.selected = true;
      weekSelect.appendChild(opt);
    });
}

async function refresh() {
  try {
    await loadSummary(weekSelect.value || undefined);
  } catch (err) {
    emptyState.hidden = false;
    emptyState.textContent = err.message;
    dashboard.hidden = true;
  }
}

weekSelect.addEventListener('change', () => loadSummary(weekSelect.value));

ingestBtn.addEventListener('click', async () => {
  ingestBtn.disabled = true;
  ingestStatus.textContent = 'Processing...';
  try {
    const { results } = await fetchJSON('/api/ingest', { method: 'POST' });
    const fileErrors = results.filter((r) => r.status === 'error');
    const fileSkips = results.filter((r) => r.status && r.status.startsWith('skipped')).length;
    const weekResults = results.flatMap((r) => r.weeks || []);
    const weeksProcessed = weekResults.filter((w) => w.status === 'processed').length;
    const weeksSkipped = weekResults.filter((w) => w.status.startsWith('skipped')).length;
    ingestStatus.textContent = results.length === 0
      ? 'No files found in data/incoming.'
      : `${weeksProcessed} week(s) processed, ${weeksSkipped} week(s) already up to date`
        + (fileSkips ? `, ${fileSkips} file(s) already ingested` : '')
        + (fileErrors.length ? `, ${fileErrors.length} file error(s)` : '') + '.';
    if (fileErrors.length) console.error('Ingest errors:', fileErrors);
    await refresh();
  } catch (err) {
    ingestStatus.textContent = `Error: ${err.message}`;
  } finally {
    ingestBtn.disabled = false;
  }
});

refresh();
