import { describe, it, expect } from 'vitest';
import { buildGoogleCalendarUrl, buildIcsContent } from './calendar';
import type { Showtime, Film, Cinema } from '../types';

const baseShowtime: Showtime = {
  id: 'st-1',
  film_id: 42,
  cinema_id: 'C0001',
  date: '2026-05-20',
  time: '20:30',
  datetime_iso: '2026-05-20T20:30:00',
  version: 'VF',
  format: 'Standard',
  experiences: [],
  week_start: '2026-05-18',
};

const baseFilm: Film = {
  id: 42,
  title: 'Mon Film Test',
  genres: [],
  actors: [],
  source_url: 'https://example.com',
  duration_minutes: 90,
};

const baseCinema: Cinema = {
  id: 'C0001',
  name: 'Cinéma Test',
  address: '10 rue du Cinéma',
  city: 'Paris',
};

describe('buildGoogleCalendarUrl', () => {
  it('returns a valid Google Calendar URL', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseFilm, baseCinema);
    expect(url).toContain('https://calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
  });

  it('encodes the film title in the URL', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseFilm, baseCinema);
    const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
    expect(decoded).toContain('Mon Film Test');
  });

  it('uses correct start date from datetime_iso', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseFilm, baseCinema);
    // 2026-05-20T20:30:00 → 20260520T203000
    expect(url).toContain('20260520T203000');
  });

  it('calculates end time using duration_minutes', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseFilm, baseCinema);
    // 20:30 + 90min = 22:00 → 20260520T220000
    expect(url).toContain('20260520T220000');
  });

  it('defaults end time to +2h when duration_minutes is null', () => {
    const film = { ...baseFilm, duration_minutes: undefined };
    const url = buildGoogleCalendarUrl(baseShowtime, film, baseCinema);
    // 20:30 + 120min = 22:30 → 20260520T223000
    expect(url).toContain('20260520T223000');
  });

  it('includes cinema name and address as location', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseFilm, baseCinema);
    // URLSearchParams uses + for spaces; decode the URL to check values
    const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
    expect(decoded).toContain('Cinéma Test');
    expect(decoded).toContain('10 rue du Cinéma');
  });

  it('uses cinema name only when address is missing', () => {
    const cinema = { ...baseCinema, address: undefined };
    const url = buildGoogleCalendarUrl(baseShowtime, baseFilm, cinema);
    const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
    expect(decoded).toContain('Cinéma Test');
    expect(decoded).not.toContain('10 rue du Cinéma');
  });
});

describe('buildIcsContent', () => {
  it('returns a string starting with BEGIN:VCALENDAR', () => {
    const ics = buildIcsContent(baseShowtime, baseFilm, baseCinema);
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
  });

  it('contains BEGIN:VEVENT and END:VEVENT', () => {
    const ics = buildIcsContent(baseShowtime, baseFilm, baseCinema);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
  });

  it('contains correct DTSTART', () => {
    const ics = buildIcsContent(baseShowtime, baseFilm, baseCinema);
    expect(ics).toContain('DTSTART:20260520T203000');
  });

  it('contains correct DTEND with duration', () => {
    const ics = buildIcsContent(baseShowtime, baseFilm, baseCinema);
    // 20:30 + 90min = 22:00
    expect(ics).toContain('DTEND:20260520T220000');
  });

  it('defaults DTEND to +2h when duration_minutes is null', () => {
    const film = { ...baseFilm, duration_minutes: undefined };
    const ics = buildIcsContent(baseShowtime, film, baseCinema);
    // 20:30 + 120min = 22:30
    expect(ics).toContain('DTEND:20260520T223000');
  });

  it('contains film title as SUMMARY', () => {
    const ics = buildIcsContent(baseShowtime, baseFilm, baseCinema);
    expect(ics).toContain('SUMMARY:Mon Film Test');
  });

  it('contains cinema name and address as LOCATION', () => {
    const ics = buildIcsContent(baseShowtime, baseFilm, baseCinema);
    expect(ics).toContain('LOCATION:Cinéma Test, 10 rue du Cinéma');
  });

  it('uses cinema name only as LOCATION when address is missing', () => {
    const cinema = { ...baseCinema, address: undefined };
    const ics = buildIcsContent(baseShowtime, baseFilm, cinema);
    expect(ics).toContain('LOCATION:Cinéma Test');
    expect(ics).not.toContain('LOCATION:Cinéma Test,');
  });

  it('ends with END:VCALENDAR', () => {
    const ics = buildIcsContent(baseShowtime, baseFilm, baseCinema);
    expect(ics.trim()).toMatch(/END:VCALENDAR$/);
  });
});
