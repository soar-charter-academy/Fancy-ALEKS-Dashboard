// One-off helper: builds a synthetic ALEKS report matching the real column
// layout, with populated Time/Learned values, for local testing only.
const path = require('path');
const XLSX = require('xlsx');

function buildSheetRows({ dateRange, students }) {
  const rows = [];
  rows[0] = ['Custom Report: WIG TEST'];
  rows[1] = ['Template: ALEKS Usage'];
  rows[2] = [`Date Range: [${dateRange}]`];
  rows[3] = ['District: SOAR CHARTER ACADEMY'];
  rows[4] = ['Generated On: TEST FIXTURE'];
  rows[5] = [];
  rows[6] = ['Student Information', 'Class Information', '', 'Pie Progress at End of Report', 'Time & Topic'];
  rows[7] = ['Student Name', 'Class Grade', 'Instructor', 'Progress (%)', `Week Total\n${dateRange}`, '', `Month Total\n${dateRange}`, '', `Total Time\n${dateRange}`, ''];
  rows[8] = ['', '', '', '', 'Time', 'Learned', 'Time', 'Learned', 'Time', 'Learned'];
  students.forEach((s) => {
    rows.push([s.name, s.grade, s.instructor, s.progress, s.weekTime, s.weekLearned, s.monthTime, s.monthLearned, s.totalTime, s.totalLearned]);
  });
  return rows;
}

const week1 = buildSheetRows({
  dateRange: '08/24/2026 - 08/28/2026',
  students: [
    { name: 'Test, Alpha', grade: 'Elementary School', instructor: 'Brewer, Erin', progress: 40, weekTime: '0:25:00', weekLearned: 3, monthTime: '0:25:00', monthLearned: 3, totalTime: '0:25:00', totalLearned: 3 },
    { name: 'Test, Beta', grade: 'Elementary School', instructor: 'Brewer, Erin', progress: 55, weekTime: '0:35:00', weekLearned: 5, monthTime: '0:35:00', monthLearned: 5, totalTime: '0:35:00', totalLearned: 5 },
    { name: 'Test, Gamma', grade: '4th Grade', instructor: 'Cox, Joanna', progress: 60, weekTime: '0:50:00', weekLearned: 4, monthTime: '0:50:00', monthLearned: 4, totalTime: '0:50:00', totalLearned: 4 },
    { name: 'Test, Delta', grade: '4th Grade', instructor: 'Cox, Joanna', progress: 20, weekTime: '0:20:00', weekLearned: 1, monthTime: '0:20:00', monthLearned: 1, totalTime: '0:20:00', totalLearned: 1 },
  ],
});

const week2 = buildSheetRows({
  dateRange: '08/31/2026 - 09/04/2026',
  students: [
    { name: 'Test, Alpha', grade: 'Elementary School', instructor: 'Brewer, Erin', progress: 42, weekTime: '0:30:00', weekLearned: 3, monthTime: '0:55:00', monthLearned: 6, totalTime: '0:55:00', totalLearned: 6 },
    { name: 'Test, Beta', grade: 'Elementary School', instructor: 'Brewer, Erin', progress: 58, weekTime: '0:20:00', weekLearned: 2, monthTime: '0:55:00', monthLearned: 7, totalTime: '0:55:00', totalLearned: 7 },
    { name: 'Test, Gamma', grade: '4th Grade', instructor: 'Cox, Joanna', progress: 70, weekTime: '1:20:00', weekLearned: 9, monthTime: '2:10:00', monthLearned: 13, totalTime: '2:10:00', totalLearned: 13 },
    { name: 'Test, Delta', grade: '4th Grade', instructor: 'Cox, Joanna', progress: 25, weekTime: '0:10:00', weekLearned: 0, monthTime: '0:30:00', monthLearned: 1, totalTime: '0:30:00', totalLearned: 1 },
  ],
});

function writeFixture(rows, filename) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Custom Report');
  const outPath = path.join(__dirname, '..', 'data', 'incoming', filename);
  XLSX.writeFile(wb, outPath);
  console.log('Wrote', outPath);
}

writeFixture(week1, 'TEST_week1.xlsx');
writeFixture(week2, 'TEST_week2.xlsx');
