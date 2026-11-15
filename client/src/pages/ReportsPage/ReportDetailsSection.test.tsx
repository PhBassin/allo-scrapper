import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReportDetails, ScrapeAttempt } from '../../api/reports';
import { ReportDetailsSection } from './ReportDetailsSection';

let nextId = 1;
function attempt(
  theater_id: string,
  theater_name: string | null,
  date: string,
  status: ScrapeAttempt['status'],
  extra: Partial<ScrapeAttempt> = {}
): ScrapeAttempt {
  return {
    id: nextId++,
    report_id: 20,
    theater_id,
    theater_name,
    date,
    status,
    movies_scraped: status === 'success' ? 6 : 0,
    showtimes_scraped: status === 'success' ? 20 : 0,
    attempted_at: '2026-03-10T03:00:00Z',
    ...extra,
  };
}

/** A report shaped like #20: a 429 on Reflet Médicis, then the cascade. */
function report20(): ReportDetails {
  const byTheater: Record<string, ScrapeAttempt[]> = {
    C0001: [
      attempt('C0001', 'Le Champo', '2026-03-10', 'success'),
      attempt('C0001', 'Le Champo', '2026-03-11', 'success'),
    ],
    C0074: [
      attempt('C0074', 'Reflet Médicis', '2026-03-10', 'success'),
      attempt('C0074', 'Reflet Médicis', '2026-03-11', 'rate_limited', {
        error_type: 'http_429',
        error_message: 'HTTP 429 Too Many Requests',
        http_status_code: 429,
      }),
    ],
    C0099: [
      attempt('C0099', 'Écoles Cinéma Club', '2026-03-10', 'not_attempted'),
      attempt('C0099', 'Écoles Cinéma Club', '2026-03-11', 'not_attempted'),
    ],
  };
  return {
    report: { id: 20, started_at: '2026-03-10T03:00:00Z', status: 'partial_success', trigger_type: 'cron' },
    attempts: byTheater,
    summary: { total_attempts: 6, successful: 3, failed: 0, rate_limited: 1, not_attempted: 2, pending: 0 },
    resumable_count: 3,
  };
}

function theaterSections() {
  return screen.getAllByTestId('theater-attempts');
}

describe('ReportDetailsSection', () => {
  it('is always rendered once details are loaded (no toggle)', () => {
    render(<ReportDetailsSection details={report20()} isLoading={false} />);

    expect(screen.getByRole('heading', { name: 'Détails des tentatives' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /détails/i })).not.toBeInTheDocument();
  });

  it('groups attempts by theater name, theaters with problems first', () => {
    render(<ReportDetailsSection details={report20()} isLoading={false} />);

    const names = theaterSections().map(s => within(s).getByTestId('theater-name').textContent);
    expect(names).toEqual(['Écoles Cinéma Club', 'Reflet Médicis', 'Le Champo']);
    expect(screen.queryByText(/Cinéma C00/)).not.toBeInTheDocument();
  });

  it('expands theaters with problems and collapses fully successful ones to one line', () => {
    render(<ReportDetailsSection details={report20()} isLoading={false} />);

    const [ecoles, reflet, champo] = theaterSections();
    expect(ecoles).toHaveAttribute('open');
    expect(reflet).toHaveAttribute('open');
    expect(champo).not.toHaveAttribute('open');
    expect(within(champo).getByTestId('theater-summary')).toHaveTextContent('2/2 dates · 12 films · 40 séances');
    expect(within(reflet).getByTestId('theater-summary')).toHaveTextContent('1/2 dates · 6 films · 20 séances');
  });

  it('shows the readable error label, HTTP code and message of a failed date', () => {
    render(<ReportDetailsSection details={report20()} isLoading={false} />);

    const reflet = theaterSections()[1];
    const failedDate = within(reflet).getByTestId('attempt-2026-03-11');
    expect(failedDate).toHaveTextContent('Limite de débit (429)');
    expect(failedDate).toHaveTextContent('HTTP 429');
    expect(failedDate).toHaveTextContent('HTTP 429 Too Many Requests');
    expect(within(reflet).getByTestId('attempt-2026-03-10')).toHaveTextContent('6 films · 20 séances');
  });

  it('labels not-attempted dates without inventing an error', () => {
    render(<ReportDetailsSection details={report20()} isLoading={false} />);

    const ecoles = theaterSections()[0];
    const date = within(ecoles).getByTestId('attempt-2026-03-10');
    expect(date).toHaveTextContent('Non tenté');
    expect(date).not.toHaveTextContent('HTTP');
  });

  it('falls back to the raw error type when it is unknown, and shows nothing when it is null', () => {
    const details = report20();
    details.attempts.C0001 = [
      attempt('C0001', 'Le Champo', '2026-03-10', 'failed', { error_type: 'http_418', error_message: 'teapot' }),
      attempt('C0001', 'Le Champo', '2026-03-11', 'failed', { error_type: null, error_message: null }),
    ];
    render(<ReportDetailsSection details={details} isLoading={false} />);

    const champo = theaterSections().find(s => within(s).getByTestId('theater-name').textContent === 'Le Champo')!;
    expect(within(champo).getByTestId('attempt-2026-03-10')).toHaveTextContent('http_418');
    expect(within(champo).getByTestId('attempt-2026-03-10')).toHaveTextContent('teapot');
    expect(within(champo).getByTestId('attempt-2026-03-11')).toHaveTextContent('Échec');
  });

  it('falls back to the theater id when its name is missing', () => {
    const details = report20();
    details.attempts = { C0042: [attempt('C0042', null, '2026-03-10', 'success')] };
    render(<ReportDetailsSection details={details} isLoading={false} />);

    expect(screen.getByTestId('theater-name')).toHaveTextContent('C0042');
  });

  it('says so when the report recorded no attempt', () => {
    const details = report20();
    details.attempts = {};
    render(<ReportDetailsSection details={details} isLoading={false} />);

    expect(screen.getByText('Aucune tentative enregistrée pour ce rapport.')).toBeInTheDocument();
  });

  it('keeps the native disclosure marker on each theater line', () => {
    render(<ReportDetailsSection details={report20()} isLoading={false} />);

    // A `summary` whose display is not `list-item` loses its triangle.
    const DISPLAY_UTILITIES = /(^|\s)(flex|inline-flex|grid|inline-grid|block|inline-block|inline|contents|hidden)(\s|$)/;
    for (const section of theaterSections()) {
      const summary = section.querySelector('summary')!;
      expect(summary.className).not.toMatch(DISPLAY_UTILITIES);
    }
  });

  it('shows a loading state before the details arrive', () => {
    render(<ReportDetailsSection details={undefined} isLoading={true} />);

    expect(screen.getByText('Chargement des détails...')).toBeInTheDocument();
  });
});
