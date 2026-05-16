import type { Showtime, Film, Cinema } from '../types';

/**
 * Convert an ISO 8601 datetime string to compact YYYYMMDDTHHMMSS format for calendar use.
 * Strips hyphens, colons, and trailing 'Z'.
 */
function toCompactDateTime(isoString: string): string {
  return isoString.replace(/[-:]/g, '').replace(/\.\d+Z?$/, '').replace('Z', '');
}

/**
 * Add minutes to an ISO 8601 datetime string and return the result as compact YYYYMMDDTHHMMSS.
 */
function addMinutesToIso(isoString: string, minutes: number): string {
  const date = new Date(isoString);
  date.setMinutes(date.getMinutes() + minutes);
  // Format manually to avoid timezone conversion — keep local representation
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${mins}${secs}`;
}

function buildLocation(cinema: Cinema): string {
  if (cinema.address) {
    return `${cinema.name}, ${cinema.address}`;
  }
  return cinema.name;
}

function buildDetails(showtime: Showtime): string {
  const parts: string[] = [];
  if (showtime.version) parts.push(showtime.version);
  if (showtime.format) parts.push(showtime.format);
  return parts.join(' ');
}

/**
 * Build a Google Calendar "add event" URL.
 * Opens in a new tab with the event pre-filled.
 */
export function buildGoogleCalendarUrl(showtime: Showtime, film: Film, cinema: Cinema): string {
  const durationMinutes = film.duration_minutes ?? 120;
  const dtStart = toCompactDateTime(showtime.datetime_iso);
  const dtEnd = addMinutesToIso(showtime.datetime_iso, durationMinutes);
  const location = buildLocation(cinema);
  const details = buildDetails(showtime);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: film.title,
    dates: `${dtStart}/${dtEnd}`,
    location,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Build the text content of an RFC 5545 .ics file for a single event.
 */
export function buildIcsContent(showtime: Showtime, film: Film, cinema: Cinema): string {
  const durationMinutes = film.duration_minutes ?? 120;
  const dtStart = toCompactDateTime(showtime.datetime_iso);
  const dtEnd = addMinutesToIso(showtime.datetime_iso, durationMinutes);
  const location = buildLocation(cinema);
  const details = buildDetails(showtime);
  const uid = `${showtime.datetime_iso}-${showtime.cinema_id}@allo-scrapper`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//allo-scrapper//FR',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${film.title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${details}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Trigger a browser download of a .ics file for the given showtime.
 */
export function downloadIcsFile(showtime: Showtime, film: Film, cinema: Cinema): void {
  const content = buildIcsContent(showtime, film, cinema);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${film.title.replace(/[^a-z0-9]/gi, '-')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
