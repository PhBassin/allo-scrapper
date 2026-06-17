import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner, ErrorMessage } from './PageStates.js';

describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('ErrorMessage', () => {
  it('displays the provided message', () => {
    render(<ErrorMessage message="Something went wrong" />);
    expect(screen.getByText('Erreur')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});