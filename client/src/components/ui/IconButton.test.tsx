import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import IconButton from './IconButton';

describe('IconButton', () => {
  it('should render with children', () => {
    render(
      <IconButton aria-label="Move up">
        <span>↑</span>
      </IconButton>
    );
    expect(screen.getByRole('button', { name: 'Move up' })).toBeInTheDocument();
  });

  it('should have cursor-pointer class', () => {
    render(
      <IconButton aria-label="Move up">
        <span>↑</span>
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('cursor-pointer');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(
      <IconButton onClick={handleClick} aria-label="Move up">
        <span>↑</span>
      </IconButton>
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply default variant styles (neutral)', () => {
    render(
      <IconButton aria-label="Move up">
        <span>↑</span>
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-gray-500');
    expect(button).toHaveClass('hover:text-gray-700');
  });

  it('should apply danger variant styles', () => {
    render(
      <IconButton variant="danger" aria-label="Delete">
        <span>×</span>
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-red-500');
    expect(button).toHaveClass('hover:text-red-700');
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <IconButton disabled aria-label="Move up">
        <span>↑</span>
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');
  });

  it('should not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <IconButton disabled onClick={handleClick} aria-label="Move up">
        <span>↑</span>
      </IconButton>
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(
      <IconButton className="ml-2" aria-label="Move up">
        <span>↑</span>
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('ml-2');
  });

  it('should require aria-label for accessibility', () => {
    render(
      <IconButton aria-label="Move up">
        <span>↑</span>
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Move up');
  });
});
