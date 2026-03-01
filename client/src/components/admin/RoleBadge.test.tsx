import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoleBadge from './RoleBadge';

describe('RoleBadge', () => {
  it('should render admin badge with crown icon', () => {
    render(<RoleBadge role="admin" />);
    
    const badge = screen.getByText(/admin/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    expect(badge.textContent).toContain('👑');
  });

  it('should render user badge', () => {
    render(<RoleBadge role="user" />);
    
    const badge = screen.getByText(/user/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    expect(badge.textContent).not.toContain('👑');
  });

  it('should have correct base styling for admin', () => {
    render(<RoleBadge role="admin" />);
    
    const badge = screen.getByText(/admin/i);
    expect(badge).toHaveClass('px-2', 'py-1', 'text-xs', 'font-semibold', 'rounded-full');
  });

  it('should have correct base styling for user', () => {
    render(<RoleBadge role="user" />);
    
    const badge = screen.getByText(/user/i);
    expect(badge).toHaveClass('px-2', 'py-1', 'text-xs', 'font-semibold', 'rounded-full');
  });
});
