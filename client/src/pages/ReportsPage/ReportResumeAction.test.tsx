import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthContext } from '../../contexts/AuthContext.js';
import type { PermissionName } from '../../types/role.js';
import { ReportResumeAction } from './ReportResumeAction.js';

function authWith(permissions: PermissionName[], isAuthenticated = true) {
  return {
    isAuthenticated,
    user: isAuthenticated
      ? { id: 1, username: 'op', role_id: 2, role_name: 'operator', is_system_role: true, permissions }
      : null,
    isAdmin: false,
    hasPermission: (p: PermissionName) => permissions.includes(p),
    login: vi.fn(),
    logout: vi.fn(),
  };
}

function renderAction(
  props: Partial<React.ComponentProps<typeof ReportResumeAction>> = {},
  permissions: PermissionName[] = ['scraper:trigger'],
  isAuthenticated = true
) {
  const onResume = vi.fn();
  render(
    <AuthContext.Provider value={authWith(permissions, isAuthenticated)}>
      <ReportResumeAction
        reportId={20}
        reportStatus="partial_success"
        resumableCount={4}
        isResuming={false}
        resumeError={null}
        onResume={onResume}
        {...props}
      />
    </AuthContext.Provider>
  );
  return { onResume };
}

describe('ReportResumeAction', () => {
  it('offers « Reprendre (N dates) » on a partial_success report with resumable attempts', () => {
    renderAction();

    expect(screen.getByRole('button', { name: 'Reprendre (4 dates)' })).toBeInTheDocument();
  });

  it('uses the singular for a single resumable date', () => {
    renderAction({ resumableCount: 1 });

    expect(screen.getByRole('button', { name: 'Reprendre (1 date)' })).toBeInTheDocument();
  });

  it.each(['success', 'failed', 'rate_limited'] as const)('is offered whatever the final status (%s)', (reportStatus) => {
    renderAction({ reportStatus });

    expect(screen.getByRole('button', { name: 'Reprendre (4 dates)' })).toBeInTheDocument();
  });

  it('resumes the report on click', () => {
    const { onResume } = renderAction();

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre (4 dates)' }));

    expect(onResume).toHaveBeenCalledWith(20);
  });

  it('is hidden when resumable_count is 0', () => {
    renderAction({ resumableCount: 0 });

    expect(screen.queryByRole('button', { name: /Reprendre/ })).not.toBeInTheDocument();
  });

  it('is hidden without the scraper:trigger permission', () => {
    renderAction({}, ['reports:view' as PermissionName]);

    expect(screen.queryByRole('button', { name: /Reprendre/ })).not.toBeInTheDocument();
  });

  it('is hidden for an anonymous visitor', () => {
    renderAction({}, ['scraper:trigger'], false);

    expect(screen.queryByRole('button', { name: /Reprendre/ })).not.toBeInTheDocument();
  });

  it('is hidden while the report is still running', () => {
    renderAction({ reportStatus: 'running' });

    expect(screen.queryByRole('button', { name: /Reprendre/ })).not.toBeInTheDocument();
  });

  it('is disabled while the resume is being queued', () => {
    renderAction({ isResuming: true });

    expect(screen.getByRole('button', { name: /Reprise en cours/ })).toBeDisabled();
  });

  it('shows why a resume failed', () => {
    renderAction({ resumeError: new Error('Network error') });

    expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  });
});
