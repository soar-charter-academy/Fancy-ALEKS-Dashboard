// Weekly ALEKS usage requirement by grade band, in minutes.
const K_TO_2_MINUTES = 30;
const GRADE_3_TO_8_MINUTES = 45;

// Normalized (lowercased, trimmed) grade-band label -> required weekly minutes.
const THRESHOLD_BY_GRADE = {
  'elementary school': K_TO_2_MINUTES,
  'kindergarten': K_TO_2_MINUTES,
  'k': K_TO_2_MINUTES,
  '1st grade': K_TO_2_MINUTES,
  '2nd grade': K_TO_2_MINUTES,
  '3rd grade': GRADE_3_TO_8_MINUTES,
  '4th grade': GRADE_3_TO_8_MINUTES,
  '5th grade': GRADE_3_TO_8_MINUTES,
  '6th grade': GRADE_3_TO_8_MINUTES,
  '7th grade': GRADE_3_TO_8_MINUTES,
  '8th grade': GRADE_3_TO_8_MINUTES,
};

/**
 * @param {string} gradeLabel raw "Class Grade" value from the report
 * @returns {{ thresholdMinutes: number, recognized: boolean }}
 */
function resolveThreshold(gradeLabel) {
  const key = String(gradeLabel || '').trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(THRESHOLD_BY_GRADE, key)) {
    return { thresholdMinutes: THRESHOLD_BY_GRADE[key], recognized: true };
  }
  console.warn(`[gradeThresholds] Unrecognized grade label "${gradeLabel}" - defaulting to ${GRADE_3_TO_8_MINUTES} min/week`);
  return { thresholdMinutes: GRADE_3_TO_8_MINUTES, recognized: false };
}

module.exports = { resolveThreshold, K_TO_2_MINUTES, GRADE_3_TO_8_MINUTES };
