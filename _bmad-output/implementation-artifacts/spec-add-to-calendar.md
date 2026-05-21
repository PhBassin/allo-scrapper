---
title: 'Add to Calendar from Showtime Button'
type: 'feature'
created: '2026-05-16'
status: 'done'
baseline_commit: 'dbf34e7b4707810760f0b36e620b2505be937c0d'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The showtime buttons in `ShowtimeList` are disabled (placeholder "Fonctionnalité à venir") — users have no way to save a screening to their calendar directly from the app.

**Approach:** Enable each showtime button so that clicking it opens a popover/dropdown with three options: add to Google Calendar (external link), add to Apple Calendar (download `.ics`), or download `.ics` directly. A shared utility generates the calendar data from the showtime + film + cinema context.

## Boundaries & Constraints

**Always:**
- Google Calendar option opens a new tab with the pre-filled `calendar.google.com/calendar/render` URL
- Apple Calendar and "Download .ics" both trigger a `.ics` file download (RFC 5545)
- Event end time = `datetime_iso` start + `film.duration_minutes` (fallback: 2h if `duration_minutes` is null)
- Popover closes on outside click or Escape key
- Only one popover open at a time
- No backend changes required — pure frontend

**Ask First:**
- If a future requirement asks to add a backend `/api/calendar` endpoint or save calendar events server-side

**Never:**
- Add a backend endpoint for this feature
- Use a third-party calendar SDK/library (only native URL construction + Blob API)
- Modify the existing `Showtime` or `Film` TypeScript types

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path — Google | User clicks showtime button, then "Google Calendar" | New tab opens with pre-filled Google Calendar event | N/A |
| Happy path — Apple / .ics | User clicks showtime button, then "Apple Calendar" or "Télécharger .ics" | Browser downloads `<film-title>.ics` file | N/A |
| Missing duration | `film.duration_minutes` is null | End time defaults to start + 120 minutes | Silent fallback, no error shown |
| Missing cinema address | `cinema.address` is null/undefined | Location field in event uses `cinema.name` only | N/A |
| Multiple popovers | User clicks a second showtime while one popover is open | First popover closes, second opens | N/A |
| Keyboard dismiss | Popover open, user presses Escape | Popover closes | N/A |

</frozen-after-approval>

## Code Map

- `client/src/components/ShowtimeList.tsx` -- showtime buttons (currently disabled); needs film + cinema props and popover logic
- `client/src/components/CinemaShowtimes.tsx` -- renders `ShowtimeList`; needs to pass cinema down
- `client/src/pages/CinemaPage.tsx` -- renders `ShowtimeList` directly; needs to pass film + cinema
- `client/src/pages/FilmPage.tsx` -- renders `CinemaShowtimes`; film context already available
- `client/src/utils/calendar.ts` -- NEW: pure utility functions to build Google Calendar URL and `.ics` blob
- `client/src/utils/calendar.test.ts` -- NEW: unit tests for the calendar utility
- `client/src/components/CalendarPopover.tsx` -- NEW: dropdown UI component (3 options, outside-click/Escape dismiss)
- `client/src/types/index.ts` -- read-only reference for `Showtime`, `Film`, `Cinema` types

## Tasks & Acceptance

**Execution:**
- [x] `client/src/utils/calendar.ts` -- CREATE: export `buildGoogleCalendarUrl(showtime, film, cinema)` and `buildIcsBlob(showtime, film, cinema)` — pure functions, no side effects
- [x] `client/src/utils/calendar.test.ts` -- CREATE (RED first): unit tests for both functions covering happy path and edge cases from I/O matrix
- [x] `client/src/components/CalendarPopover.tsx` -- CREATE: accessible popover with 3 buttons (Google, Apple, .ics); accepts `onClose`, `showtime`, `film`, `cinema` props; manages its own outside-click and Escape listener
- [x] `client/src/components/ShowtimeList.tsx` -- MODIFY: add `film: Film` and `cinema: Cinema` props; replace `disabled` buttons with interactive buttons that toggle `CalendarPopover`; remove "Fonctionnalité à venir" title
- [x] `client/src/components/CinemaShowtimes.tsx` -- MODIFY: accept `film: Film` prop and pass it + `cinema` to `ShowtimeList`
- [x] `client/src/pages/FilmPage.tsx` -- MODIFY: pass `film` to `CinemaShowtimes`
- [x] `client/src/pages/CinemaPage.tsx` -- MODIFY: pass `film` and `cinema` directly to `ShowtimeList`

**Acceptance Criteria:**
- Given a film card with visible showtimes, when the user clicks an hourly button, then a popover appears with 3 labelled options: "Google Calendar", "Apple Calendar", "Télécharger .ics"
- Given the popover is open, when the user clicks "Google Calendar", then a new browser tab opens with the event pre-filled (title = film title, start/end time correct, location = cinema name + address)
- Given the popover is open, when the user clicks "Apple Calendar" or "Télécharger .ics", then the browser downloads a valid `.ics` file with VEVENT containing correct DTSTART, DTEND, SUMMARY, LOCATION
- Given the popover is open, when the user clicks outside it or presses Escape, then the popover closes
- Given `film.duration_minutes` is null, when generating the event, then end time = start + 2 hours
- Given `cinema.address` is null, when generating the event, then LOCATION = cinema name alone
- Given tests run, when `npm run test:run` executes in `client/`, then all calendar utility tests pass

## Design Notes

**Google Calendar URL format:**
```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text=<film title>
  &dates=<YYYYMMDDTHHMMSS>/<YYYYMMDDTHHMMSS>   (local time, no Z suffix)
  &details=<version + format>
  &location=<cinema name, address>
```

**ICS format (minimal RFC 5545):**
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//allo-scrapper//FR
BEGIN:VEVENT
UID:<datetime_iso>-<cinema_id>@allo-scrapper
DTSTART:<YYYYMMDDTHHMMSS>
DTEND:<YYYYMMDDTHHMMSS>
SUMMARY:<film title>
LOCATION:<cinema name, address>
DESCRIPTION:<version> <format>
END:VEVENT
END:VCALENDAR
```

Date format uses `datetime_iso` (already ISO 8601) — strip hyphens, colons, and the `Z` if present to get the `YYYYMMDDTHHMMSS` compact form.

## Verification

**Commands:**
- `cd client && npm run test:run` -- expected: all tests pass including new calendar utility tests
- `cd client && npx tsc --noEmit` -- expected: no TypeScript errors

**Manual checks:**
- Click a showtime button on the home page → popover appears with 3 options
- Click "Google Calendar" → new tab with correct event data
- Click "Télécharger .ics" → file downloaded and opens in a calendar app
- Click outside the popover → it closes without error
