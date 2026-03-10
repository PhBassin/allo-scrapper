import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoleBadge from './RoleBadge';

describe('RoleBadge', () => {
  it('should render admin badge with crown icon', () => {
    render(<RoleBadge roleName="admin" />);

    const badge = screen.getByText(/admin/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    expect(badge.textContent).toContain('👑');
  });

  it('should render non-admin system role with blue badge', () => {
    render(<RoleBadge roleName="operator" isSystem />);

    const badge = screen.getByText('operator');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    expect(badge.textContent).not.toContain('👑');
  });

  it('should render non-system custom role with gray badge', () => {
    render(<RoleBadge roleName="viewer" />);

    const badge = screen.getByText('viewer');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('should have correct base styling', () => {
    render(<RoleBadge roleName="admin" />);

    const badge = screen.getByText(/admin/i);
    expect(badge).toHaveClass('px-2', 'py-1', 'text-xs', 'font-semibold', 'rounded-full');
  });

  it('should display roleName as label', () => {
    render(<RoleBadge roleName="superuser" />);
    expect(screen.getByText('superuser')).toBeInTheDocument();
  });
});
