/**
 * Per class per week: % of students who met their grade-band weekly minute requirement.
 * @param {object} week normalized week object (see parseReport.js)
 */
function computeCompliance(week) {
  return Object.entries(week.classes).map(([className, cls]) => {
    const total = cls.students.length;
    const met = cls.students.filter((s) => s.weekMinutes >= cls.thresholdMinutes).length;
    return {
      className,
      gradeBand: cls.gradeBand,
      thresholdMinutes: cls.thresholdMinutes,
      studentsMet: met,
      studentsTotal: total,
      compliancePct: total === 0 ? 0 : Math.round((met / total) * 1000) / 10,
    };
  });
}

/**
 * Per class: the student(s) with the most topics learned this week.
 */
function computeTopLearners(week) {
  return Object.entries(week.classes).map(([className, cls]) => {
    const maxLearned = cls.students.reduce((max, s) => Math.max(max, s.weekTopicsLearned), 0);
    const topStudents = maxLearned > 0
      ? cls.students.filter((s) => s.weekTopicsLearned === maxLearned).map((s) => s.name)
      : [];
    return { className, gradeBand: cls.gradeBand, topics: maxLearned, students: topStudents };
  });
}

function sumClassWeek(cls) {
  return cls.students.reduce(
    (acc, s) => ({
      minutes: acc.minutes + s.weekMinutes,
      topics: acc.topics + s.weekTopicsLearned,
    }),
    { minutes: 0, topics: 0 }
  );
}

/**
 * Week-over-week usage-minute growth per class (most improved by usage).
 * @param {object} currentWeek
 * @param {object|null} previousWeek pass null if there's no prior week yet
 */
function computeMostImproved(currentWeek, previousWeek) {
  if (!previousWeek) {
    return { available: false, byUsage: [] };
  }

  const deltas = Object.keys(currentWeek.classes).map((className) => {
    const current = sumClassWeek(currentWeek.classes[className]);
    const previous = previousWeek.classes[className]
      ? sumClassWeek(previousWeek.classes[className])
      : { minutes: 0, topics: 0 };
    return { className, minutesDelta: current.minutes - previous.minutes };
  });

  const byUsage = deltas.sort((a, b) => b.minutesDelta - a.minutesDelta);

  return { available: true, byUsage };
}

/**
 * Total topics learned per class for this week (no comparison to prior
 * week needed, so it's available from the very first processed week).
 */
function computeTopicsTotals(week) {
  return Object.entries(week.classes)
    .map(([className, cls]) => ({ className, gradeBand: cls.gradeBand, topics: sumClassWeek(cls).topics }))
    .sort((a, b) => b.topics - a.topics);
}

// Nearest-rank 25th percentile: the value at or below which the bottom
// quarter of a sorted list falls.
function quartileThreshold(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(Math.ceil(sorted.length * 0.25) - 1, 0);
  return sorted[idx];
}

const CONSECUTIVE_WEEKS_FOR_CONCERN = 2;

/**
 * Per-student weekly minutes/topics history and concern flags for one class,
 * across a chronological window of weeks ending at the target (most recent) week.
 * - minutesConcern: missed the grade-band minute requirement each of the last
 *   CONSECUTIVE_WEEKS_FOR_CONCERN weeks.
 * - topicsConcern: fell in the bottom quartile of the class's topics-learned
 *   distribution each of the last CONSECUTIVE_WEEKS_FOR_CONCERN weeks.
 * @param {Array<object>} weeksAsc chronological week objects, last one is the target week
 * @param {string} className
 */
function computeClassDetail(weeksAsc, className) {
  const targetWeek = weeksAsc[weeksAsc.length - 1];
  const targetClass = targetWeek.classes[className];
  if (!targetClass) return null;

  const thresholdMinutes = targetClass.thresholdMinutes;
  const quartileByWeek = weeksAsc.map((w) => {
    const cls = w.classes[className];
    return cls ? quartileThreshold(cls.students.map((s) => s.weekTopicsLearned)) : null;
  });

  const students = targetClass.students.map(({ name }) => {
    const minutesHistory = weeksAsc.map((w) => {
      const student = w.classes[className]?.students.find((s) => s.name === name);
      return {
        weekStart: w.weekStart,
        minutes: student ? student.weekMinutes : null,
        met: student ? student.weekMinutes >= thresholdMinutes : null,
      };
    });

    const topicsHistory = weeksAsc.map((w, i) => {
      const student = w.classes[className]?.students.find((s) => s.name === name);
      const quartile = quartileByWeek[i];
      return {
        weekStart: w.weekStart,
        topics: student ? student.weekTopicsLearned : null,
        lowQuartile: student && quartile !== null ? student.weekTopicsLearned <= quartile : null,
      };
    });

    const recentMinutes = minutesHistory.slice(-CONSECUTIVE_WEEKS_FOR_CONCERN);
    const minutesConcern = recentMinutes.length === CONSECUTIVE_WEEKS_FOR_CONCERN && recentMinutes.every((h) => h.met === false);

    const recentTopics = topicsHistory.slice(-CONSECUTIVE_WEEKS_FOR_CONCERN);
    const topicsConcern = recentTopics.length === CONSECUTIVE_WEEKS_FOR_CONCERN && recentTopics.every((h) => h.lowQuartile === true);

    const current = minutesHistory[minutesHistory.length - 1];
    const currentTopics = topicsHistory[topicsHistory.length - 1];

    return {
      name,
      weekMinutes: current.minutes,
      weekTopicsLearned: currentTopics.topics,
      minutesHistory,
      topicsHistory,
      flags: { minutesConcern, topicsConcern },
    };
  });

  return {
    className,
    gradeBand: targetClass.gradeBand,
    thresholdMinutes,
    weekStart: targetWeek.weekStart,
    students,
  };
}

module.exports = {
  computeCompliance,
  computeTopLearners,
  computeMostImproved,
  computeTopicsTotals,
  computeClassDetail,
};
