import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarPopover from './CalendarPopover';
import type { Showtime, Film, Cinema } from '../types';

const mockBuildGoogleCalendarUrl = vi.fn(() => 'https://calendar.google.com/calendar/render?action=TEMPLATE');
const mockDownloadIcsFile = vi.fn();

vi.mock('../utils/calendar', () => ({
  buildGoogleCalendarUrl: (...args: unknown[]) => mockBuildGoogleCalendarUrl(...args),
  downloadIcsFile: (...args: unknown[]) => mockDownloadIcsFile(...args),
}));

const showtime: Showtime = {
  id: 'st-1',
  film_id: 1,
  cinema_id: 'C1',
  date: '2026-05-20',
  time: '20:30',
  datetime_iso: '2026-05-20T20:30:00',
  experiences: [],
  week_start: '2026-05-18',
};

const film: Film = {
  id: 1,
  title: 'Film Test',
  genres: [],
  actors: [],
  source_url: 'https://example.com',
};

const cinema: Cinema = {
  id: 'C1',
  name: 'Cinema Test',
  city: 'Paris',
};

describe('CalendarPopover', () => {
  const onClose = vi.fn();
  const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  let anchorButton: HTMLButtonElement;

  beforeEach(() => {
    vi.clearAllMocks();
    anchorButton = document.createElement('button');
    anchorButton.getBoundingClientRect = vi.fn(() => ({
      x: 100,
      y: 200,
      width: 80,
      height: 32,
      top: 200,
      right: 180,
      bottom: 232,
      left: 100,
      toJSON: () => ({}),
    })) as unknown as typeof anchorButton.getBoundingClientRect;
    document.body.appendChild(anchorButton);
  });

  afterEach(() => {
    if (anchorButton.parentNode) {
      anchorButton.parentNode.removeChild(anchorButton);
    }
  });

  it('renders exactly two calendar actions', () => {
    render(
      <CalendarPopover
        showtime={showtime}
        film={film}
        cinema={cinema}
        anchorRef={{ current: anchorButton }}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('menuitem', { name: /google calendar/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /apple \/ outlook/i })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('opens Google Calendar URL and closes popover', () => {
    render(
      <CalendarPopover
        showtime={showtime}
        film={film}
        cinema={cinema}
        anchorRef={{ current: anchorButton }}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /google calendar/i }));

    expect(mockBuildGoogleCalendarUrl).toHaveBeenCalledWith(showtime, film, cinema);
    expect(openSpy).toHaveBeenCalledWith(
      'https://calendar.google.com/calendar/render?action=TEMPLATE',
      '_blank',
      'noopener,noreferrer'
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('downloads .ics file for Apple/Outlook and closes popover', () => {
    render(
      <CalendarPopover
        showtime={showtime}
        film={film}
        cinema={cinema}
        anchorRef={{ current: anchorButton }}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /apple \/ outlook/i }));

    expect(mockDownloadIcsFile).toHaveBeenCalledWith(showtime, film, cinema);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
