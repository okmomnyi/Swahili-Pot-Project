'use strict';

const pool = require('../db/pool');

const dstr = (v) => (v ? new Date(v).toDateString() : 'N/A');

// Kenya is UTC+3 year-round (no DST), so EAT is a fixed +3h shift. Shifting the
// UTC instant lets us read EAT wall-clock fields via the getUTC* accessors.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const toEat = (v) => new Date(new Date(v).getTime() + EAT_OFFSET_MS);
const ymd = (eat) =>
  `${eat.getUTCFullYear()}-${String(eat.getUTCMonth() + 1).padStart(2, '0')}-${String(eat.getUTCDate()).padStart(2, '0')}`;
const hm = (eat) =>
  `${String(eat.getUTCHours()).padStart(2, '0')}:${String(eat.getUTCMinutes()).padStart(2, '0')}`;
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayNum = (ymdStr) => {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};
const minsToHm = (mins) => {
  const total = Math.round(mins);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Derive a deep behavioural analytics bundle from raw attendance rows.
 * Everything here is computed from real timestamps — no inference.
 */
function analyseAttendance(rows, nowMs) {
  const total = rows.length;
  if (total === 0) {
    return { total: 0 };
  }

  const confirmed = rows.filter((r) => r.is_confirmed).length;
  const checkedOut = rows.filter((r) => r.check_out).length;

  const dayset = new Set();
  const dowCounts = Array(7).fill(0);
  const arrivalMins = [];
  const durations = [];
  const mondayKeys = new Set();
  let before9 = 0;
  let before10 = 0;
  let after12 = 0;
  let last14Days = new Set();
  let prev14Days = new Set();
  const recent = [];

  const fourteen = 14 * 86400000;

  for (const r of rows) {
    const eatIn = toEat(r.check_in);
    const day = ymd(eatIn);
    dayset.add(day);
    dowCounts[eatIn.getUTCDay()] += 1;

    const mins = eatIn.getUTCHours() * 60 + eatIn.getUTCMinutes();
    arrivalMins.push(mins);
    if (eatIn.getUTCHours() < 9) before9 += 1;
    if (eatIn.getUTCHours() < 10) before10 += 1;
    if (eatIn.getUTCHours() >= 12) after12 += 1;

    // Monday-of-week key for "weeks active".
    const dn = dayNum(day);
    const monday = dn - ((toEat(r.check_in).getUTCDay() + 6) % 7);
    mondayKeys.add(monday);

    const age = nowMs - new Date(r.check_in).getTime();
    if (age <= fourteen) last14Days.add(day);
    else if (age <= 2 * fourteen) prev14Days.add(day);

    if (r.check_out) {
      const dur = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 60000;
      if (dur > 0 && dur < 24 * 60) durations.push(dur);
    }
  }

  // Recent session log (most recent 40).
  for (const r of rows.slice(-40).reverse()) {
    const eatIn = toEat(r.check_in);
    const dur = r.check_out
      ? minsToHm((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 60000)
      : '—';
    recent.push({
      date: ymd(eatIn),
      dow: DOW[eatIn.getUTCDay()].slice(0, 3),
      time: hm(eatIn),
      confirmed: r.is_confirmed,
      duration: dur,
      session: r.session_label || 'Unnamed',
      tasks: (r.tasks_completed || '').trim(),
    });
  }

  // Longest consecutive-day streak.
  const sortedDays = [...dayset].sort();
  let streak = sortedDays.length ? 1 : 0;
  let best = streak;
  for (let i = 1; i < sortedDays.length; i += 1) {
    if (dayNum(sortedDays[i]) - dayNum(sortedDays[i - 1]) === 1) {
      streak += 1;
      best = Math.max(best, streak);
    } else {
      streak = 1;
    }
  }

  const avgArrival = arrivalMins.reduce((a, b) => a + b, 0) / arrivalMins.length;
  const firstMs = new Date(rows[0].check_in).getTime();
  const lastMs = new Date(rows[rows.length - 1].check_in).getTime();

  // Tasks-completed free-text corpus (unique, non-empty).
  const taskCorpus = [
    ...new Set(rows.map((r) => (r.tasks_completed || '').trim()).filter(Boolean)),
  ];

  return {
    total,
    confirmed,
    confirmRate: Math.round((confirmed / total) * 100),
    checkedOut,
    distinctDays: dayset.size,
    weeksActive: mondayKeys.size,
    longestStreak: best,
    firstSeen: rows[0].check_in,
    lastSeen: rows[rows.length - 1].check_in,
    daysSinceLast: Math.floor((nowMs - lastMs) / 86400000),
    spanDays: Math.max(1, Math.round((lastMs - firstMs) / 86400000)),
    avgArrival: minsToHm(avgArrival),
    earliestArrival: minsToHm(Math.min(...arrivalMins)),
    latestArrival: minsToHm(Math.max(...arrivalMins)),
    pctBefore9: Math.round((before9 / total) * 100),
    pctBefore10: Math.round((before10 / total) * 100),
    pctAfter12: Math.round((after12 / total) * 100),
    avgDuration: durations.length ? minsToHm(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    durationSamples: durations.length,
    dow: DOW.map((name, i) => ({ name, count: dowCounts[i] })).filter((d) => d.count > 0),
    last14: last14Days.size,
    prev14: prev14Days.size,
    recent,
    taskCorpus,
  };
}

/**
 * Assemble a rich, data-dense context for one trainee (the "attachee").
 * The AI sees ONLY this — no direct DB access. Everything is grounded in real
 * timestamps and records so the resulting profile stays accurate.
 */
async function buildAttacheeContext(attacheeId, departmentId) {
  const traineeRes = await pool.query(
    `SELECT t.id, t.name, t.phone, t.is_active, t.created_at AS enrolled_at,
            d.name AS department_name
       FROM trainees t
       JOIN departments d ON d.id = t.department_id
      WHERE t.id = $1 AND t.department_id = $2`,
    [attacheeId, departmentId]
  );
  if (!traineeRes.rows.length) throw new Error('Attachee not found');
  const t = traineeRes.rows[0];

  const [attRowsRes, programRes] = await Promise.all([
    pool.query(
      `SELECT ar.check_in, ar.check_out, ar.is_confirmed, ar.tasks_completed,
              s.session_label
         FROM attendance_records ar
         JOIN attendance_sessions s ON s.id = ar.session_id
        WHERE s.department_id = $1 AND ar.trainee_phone = $2
        ORDER BY ar.check_in ASC
        LIMIT 1000`,
      [departmentId, t.phone]
    ),
    pool.query(
      `SELECT p.name, p.start_date, p.end_date, pe.enrolled_at
         FROM program_enrollments pe
         JOIN programs p ON p.id = pe.program_id
        WHERE pe.trainee_id = $1
        ORDER BY pe.enrolled_at DESC`,
      [attacheeId]
    ),
  ]);

  const nowMs = Date.now();
  const a = analyseAttendance(attRowsRes.rows, nowMs);
  const programs = programRes.rows;
  const tenureDays = Math.max(0, Math.floor((nowMs - new Date(t.enrolled_at).getTime()) / 86400000));

  if (a.total === 0) {
    return `
ATTACHEE PROFILE
================
Name: ${t.name} | Phone: ${t.phone} | Department: ${t.department_name}
Status: ${t.is_active ? 'Active' : 'Inactive'} | Enrolled: ${dstr(t.enrolled_at)} (${tenureDays} days ago)

ATTENDANCE: No QR check-ins recorded for this trainee yet.

PROGRAMME ENROLMENT
${programs.length ? programs.map((p) => `• ${p.name} (${dstr(p.start_date)} → ${p.end_date ? dstr(p.end_date) : 'ongoing'})`).join('\n') : 'None.'}

NOTE: Only attendance and programme data exist for trainee records in this
system (no task/submission links). With no attendance yet, keep the profile
brief, flag the lack of engagement data, and avoid inventing any performance.
`.trim();
  }

  const trend =
    a.last14 > a.prev14 ? 'IMPROVING' : a.last14 < a.prev14 ? 'DECLINING' : 'STEADY';
  const engagementDaysPerWeek = a.weeksActive ? (a.distinctDays / a.weeksActive).toFixed(1) : '0';

  const recentTable = a.recent
    .map(
      (r) =>
        `${r.date} (${r.dow}) in ${r.time}, stay ${r.duration}, ${r.confirmed ? 'confirmed' : 'unconfirmed'}, session "${r.session}"${r.tasks ? ` — reported: ${r.tasks.slice(0, 160)}` : ''}`
    )
    .join('\n');

  return `
ATTACHEE PROFILE
================
Name:        ${t.name}
Phone:       ${t.phone}
Department:  ${t.department_name}
Status:      ${t.is_active ? 'Active' : 'Inactive'}
Enrolled:    ${dstr(t.enrolled_at)} (tenure: ${tenureDays} days)

ATTENDANCE — VOLUME & CONSISTENCY (QR check-ins matched by phone)
================================================================
Total check-ins:            ${a.total}
Distinct days attended:     ${a.distinctDays}
Active weeks:               ${a.weeksActive}  (avg ${engagementDaysPerWeek} days/week)
Longest attendance streak:  ${a.longestStreak} consecutive day(s)
Confirmed by instructor:    ${a.confirmed}/${a.total} (${a.confirmRate}%)
Sessions checked out of:    ${a.checkedOut}
Activity span:              ${dstr(a.firstSeen)} → ${dstr(a.lastSeen)} (${a.spanDays} days)
Days since last seen:       ${a.daysSinceLast}

ATTENDANCE — PUNCTUALITY & RHYTHM (East Africa Time)
====================================================
Average arrival time:       ${a.avgArrival}
Earliest / latest arrival:  ${a.earliestArrival} / ${a.latestArrival}
Arrived before 09:00:       ${a.pctBefore9}% of check-ins
Arrived before 10:00:       ${a.pctBefore10}% of check-ins
Arrived after 12:00:        ${a.pctAfter12}% of check-ins
Average session duration:   ${a.avgDuration || 'N/A'}${a.avgDuration ? ` (from ${a.durationSamples} checked-out sessions)` : ''}
Day-of-week pattern:        ${a.dow.map((d) => `${d.name.slice(0, 3)} ${d.count}`).join(', ')}

ATTENDANCE — RECENT TREND
=========================
Distinct days in last 14:   ${a.last14}
Distinct days prior 14:     ${a.prev14}
Trend:                      ${trend}

WORK REPORTED AT CHECK-IN (free-text "tasks completed", where provided)
=======================================================================
${a.taskCorpus.length ? a.taskCorpus.slice(0, 30).map((x) => `• ${x.slice(0, 200)}`).join('\n') : 'No task notes were recorded at check-in.'}

PROGRAMME ENROLMENT
===================
${programs.length
  ? programs.map((p) => `• ${p.name} (${dstr(p.start_date)} → ${p.end_date ? dstr(p.end_date) : 'ongoing'})`).join('\n')
  : 'Not enrolled in any programme.'}

RECENT SESSION LOG (most recent ${a.recent.length})
====================================================
${recentTable}

NOTE ON AVAILABLE DATA
======================
Trainee records link to attendance (above) and programme enrolment only — task
assignments and document submissions live on separate user accounts and are NOT
available here. Build the richest possible assessment from the attendance
behaviour, punctuality, consistency, trend, and any reported work above, but do
NOT invent submissions, grades, or task outcomes that are not shown.
`.trim();
}

/**
 * Assemble department-level context for the supervisor AI assistant.
 * Trainees + their attendance (matched by phone), plus department-wide
 * submission and task statistics.
 */
async function buildDepartmentContext(departmentId) {
  const [deptRes, traineeRes, subStatsRes, taskStatsRes, recentRes] = await Promise.all([
    pool.query('SELECT name FROM departments WHERE id = $1', [departmentId]),
    pool.query(
      `SELECT t.name, t.phone,
              COUNT(ar.id)::int AS check_ins,
              COUNT(*) FILTER (WHERE ar.is_confirmed)::int AS confirmed,
              COUNT(DISTINCT (ar.check_in AT TIME ZONE 'Africa/Nairobi')::date)::int AS days
         FROM trainees t
         LEFT JOIN attendance_records ar ON ar.trainee_phone = t.phone
         LEFT JOIN attendance_sessions s ON s.id = ar.session_id AND s.department_id = $1
        WHERE t.department_id = $1 AND t.is_active = true
        GROUP BY t.id, t.name, t.phone
        ORDER BY days DESC`,
      [departmentId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'submitted')::int    AS submitted,
              COUNT(*) FILTER (WHERE status = 'acknowledged')::int AS acknowledged,
              COUNT(*) FILTER (WHERE status = 'returned')::int     AS returned
         FROM form_submissions WHERE department_id = $1`,
      [departmentId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status IN ('open', 'pending'))::int AS open,
              COUNT(*) FILTER (WHERE status = 'in_progress')::int        AS in_progress,
              COUNT(*) FILTER (WHERE status = 'submitted')::int          AS submitted,
              COUNT(*) FILTER (WHERE status IN ('reviewed', 'completed'))::int AS done
         FROM tasks WHERE department_id = $1`,
      [departmentId]
    ),
    pool.query(
      `SELECT fs.title, fs.status, fs.submitted_at, u.name AS filed_by
         FROM form_submissions fs JOIN users u ON u.id = fs.instructor_id
        WHERE fs.department_id = $1
        ORDER BY fs.submitted_at DESC LIMIT 10`,
      [departmentId]
    ),
  ]);

  const dept = deptRes.rows[0];
  const trainees = traineeRes.rows;
  const subs = subStatsRes.rows[0];
  const tasks = taskStatsRes.rows[0];
  const recent = recentRes.rows;

  return `
DEPARTMENT: ${dept?.name || 'Unknown'}
Active trainees: ${trainees.length}

TRAINEE ATTENDANCE OVERVIEW (QR check-ins matched by phone)
==========================================================
${trainees.length
  ? trainees
      .map((a) => `• ${a.name}: ${a.days} days attended, ${a.confirmed}/${a.check_ins} check-ins confirmed`)
      .join('\n')
  : 'No active trainees.'}

DEPARTMENT SUBMISSION STATISTICS
================================
Total: ${subs.total} | Submitted: ${subs.submitted} | Acknowledged: ${subs.acknowledged} | Returned: ${subs.returned}

DEPARTMENT TASK STATISTICS
==========================
Total: ${tasks.total} | Open: ${tasks.open} | In progress: ${tasks.in_progress} | Submitted: ${tasks.submitted} | Reviewed/Done: ${tasks.done}

RECENT SUBMISSIONS
==================
${recent.length
  ? recent.map((r) => `[${dstr(r.submitted_at)}] ${r.filed_by} — "${r.title}" (${r.status})`).join('\n')
  : 'No submissions yet.'}
`.trim();
}

module.exports = { buildAttacheeContext, buildDepartmentContext };
