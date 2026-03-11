import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import LinkButton from './LinkButton';

describe('LinkButton', () => {
  it('should render with children', () => {
    render(<LinkButton>Edit</LinkButton>);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('should have cursor-pointer class', () => {
    render(<LinkButton>Edit</LinkButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('cursor-pointer');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<LinkButton onClick={handleClick}>Edit</LinkButton>);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply default variant styles (primary)', () => {
    render(<LinkButton>Edit</LinkButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-blue-600');
    expect(button).toHaveClass('hover:text-blue-900');
  });

  it('should apply danger variant styles', () => {
    render(<LinkButton variant="danger">Delete</LinkButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-red-600');
    expect(button).toHaveClass('hover:text-red-900');
  });

  it('should apply success variant styles', () => {
    render(<LinkButton variant="success">Approve</LinkButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-green-600');
    expect(button).toHaveClass('hover:text-green-900');
  });

  it('should apply warning variant styles', () => {
    render(<LinkButton variant="warning">Reset</LinkButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-yellow-600');
    expect(button).toHaveClass('hover:text-yellow-900');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<LinkButton disabled>Edit</LinkButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');
  });

  it('should not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<LinkButton disabled onClick={handleClick}>Edit</LinkButton>);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<LinkButton className="ml-2">Edit</LinkButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('ml-2');
  });

  it('should forward additional props to button element', () => {
    render(<LinkButton data-testid="test-link-button">Edit</LinkButton>);
    const button = screen.getByTestId('test-link-button');
    expect(button).toBeInTheDocument();
  });
});
