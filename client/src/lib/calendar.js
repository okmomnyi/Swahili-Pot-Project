// Helpers to add a reminder to a calendar without any OAuth:
//  - a Google Calendar "template" link (opens pre-filled; user taps Save)
//  - a downloadable .ics file (works with Apple / Outlook / Google, incl. phones)

const DEFAULT_DURATION_MIN = 30;

// Date/ISO -> UTC basic format YYYYMMDDTHHMMSSZ
function toUtcStamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function endFrom(start, end) {
  if (end) return end;
  return new Date(new Date(start).getTime() + DEFAULT_DURATION_MIN * 60 * 1000);
}

export function googleCalendarUrl({ title, details = '', location = '', start, end }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Reminder',
    dates: `${toUtcStamp(start)}/${toUtcStamp(endFrom(start, end))}`,
  });
  if (details) params.set('details', details);
  if (location) params.set('location', location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildIcs({ title, details = '', location = '', start, end }) {
  const dtStart = toUtcStamp(start);
  const dtEnd = toUtcStamp(endFrom(start, end));
  const uid = `${dtStart}-${Date.now()}@swahilipothub.co.ke`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SwahiliPot IMS//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(title || 'Reminder')}`,
    details ? `DESCRIPTION:${escapeIcs(details)}` : '',
    location ? `LOCATION:${escapeIcs(location)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(title || 'Reminder')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.filter(Boolean).join('\r\n');
}

export function downloadIcs(opts) {
  const blob = new Blob([buildIcs(opts)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(opts.title || 'reminder').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
