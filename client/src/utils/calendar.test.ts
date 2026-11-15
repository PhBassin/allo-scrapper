import { describe, it, expect } from 'vitest';
import { buildGoogleCalendarUrl, buildIcsContent } from './calendar';
import type { Showtime, Movie, Theater } from '../types';

const baseShowtime: Showtime = {
  id: 'st-1',
  movie_id: 42,
  theater_id: 'C0001',
  date: '2026-05-20',
  time: '20:30',
  datetime_iso: '2026-05-20T20:30:00',
  version: 'VF',
  format: 'Standard',
  experiences: [],
  week_start: '2026-05-18',
};

const baseMovie: Movie = {
  id: 42,
  title: 'Mon Film Test',
  genres: [],
  actors: [],
  source_url: 'https://example.com',
  duration_minutes: 90,
};

const baseTheater: Theater = {
  id: 'C0001',
  name: 'Cinéma Test',
  address: '10 rue du Cinéma',
  city: 'Paris',
};

describe('buildGoogleCalendarUrl', () => {
  it('returns a valid Google Calendar URL', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseMovie, baseTheater);
    expect(url).toContain('https://calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
  });

  it('encodes the film title in the URL', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseMovie, baseTheater);
    const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
    expect(decoded).toContain('Mon Film Test');
  });

  it('uses correct start date from datetime_iso', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseMovie, baseTheater);
    // 2026-05-20T20:30:00 → 20260520T203000
    expect(url).toContain('20260520T203000');
  });

  it('calculates end time using duration_minutes', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseMovie, baseTheater);
    // 20:30 + 90min = 22:00 → 20260520T220000
    expect(url).toContain('20260520T220000');
  });

  it('defaults end time to +2h when duration_minutes is null', () => {
    const movie = { ...baseMovie, duration_minutes: undefined };
    const url = buildGoogleCalendarUrl(baseShowtime, movie, baseTheater);
    // 20:30 + 120min = 22:30 → 20260520T223000
    expect(url).toContain('20260520T223000');
  });

  it('includes theater name and the formatted address as location', () => {
    const url = buildGoogleCalendarUrl(baseShowtime, baseMovie, baseTheater);
    expect(new URL(url).searchParams.get('location')).toBe('Cinéma Test, 10 rue du Cinéma, Paris');
  });

  it('includes the postal code in the location when known', () => {
    const theater = { ...baseTheater, postal_code: '75001' };
    const url = buildGoogleCalendarUrl(baseShowtime, baseMovie, theater);
    expect(new URL(url).searchParams.get('location')).toBe('Cinéma Test, 10 rue du Cinéma, 75001 Paris');
  });

  it('uses theater name and city when address is missing', () => {
    const theater = { ...baseTheater, address: undefined };
    const url = buildGoogleCalendarUrl(baseShowtime, baseMovie, theater);
    expect(new URL(url).searchParams.get('location')).toBe('Cinéma Test, Paris');
  });

  it('uses theater name only when every address part is missing', () => {
    const theater = { ...baseTheater, address: undefined, city: undefined };
    const url = buildGoogleCalendarUrl(baseShowtime, baseMovie, theater);
    expect(new URL(url).searchParams.get('location')).toBe('Cinéma Test');
  });
});

describe('buildIcsContent', () => {
  it('returns a string starting with BEGIN:VCALENDAR', () => {
    const ics = buildIcsContent(baseShowtime, baseMovie, baseTheater);
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
  });

  it('contains BEGIN:VEVENT and END:VEVENT', () => {
    const ics = buildIcsContent(baseShowtime, baseMovie, baseTheater);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
  });

  it('contains correct DTSTART', () => {
    const ics = buildIcsContent(baseShowtime, baseMovie, baseTheater);
    expect(ics).toContain('DTSTART:20260520T203000');
  });

  it('contains correct DTEND with duration', () => {
    const ics = buildIcsContent(baseShowtime, baseMovie, baseTheater);
    // 20:30 + 90min = 22:00
    expect(ics).toContain('DTEND:20260520T220000');
  });

  it('defaults DTEND to +2h when duration_minutes is null', () => {
    const movie = { ...baseMovie, duration_minutes: undefined };
    const ics = buildIcsContent(baseShowtime, movie, baseTheater);
    // 20:30 + 120min = 22:30
    expect(ics).toContain('DTEND:20260520T223000');
  });

  it('contains film title as SUMMARY', () => {
    const ics = buildIcsContent(baseShowtime, baseMovie, baseTheater);
    expect(ics).toContain('SUMMARY:Mon Film Test');
  });

  it('contains theater name and the formatted address as LOCATION (RFC 5545 escaped)', () => {
    const ics = buildIcsContent(baseShowtime, baseMovie, { ...baseTheater, postal_code: '75001' });
    // RFC 5545 requires commas to be escaped as \,
    expect(ics).toContain('LOCATION:Cinéma Test\\, 10 rue du Cinéma\\, 75001 Paris');
  });

  it('uses theater name and city as LOCATION when address is missing', () => {
    const theater = { ...baseTheater, address: undefined };
    const ics = buildIcsContent(baseShowtime, baseMovie, theater);
    expect(ics).toContain('LOCATION:Cinéma Test\\, Paris\r\n');
  });

  it('uses theater name only as LOCATION when every address part is missing', () => {
    const theater = { ...baseTheater, address: undefined, city: undefined };
    const ics = buildIcsContent(baseShowtime, baseMovie, theater);
    expect(ics).toContain('LOCATION:Cinéma Test\r\n');
  });

  it('ends with END:VCALENDAR', () => {
    const ics = buildIcsContent(baseShowtime, baseMovie, baseTheater);
    expect(ics.trim()).toMatch(/END:VCALENDAR$/);
  });
});
