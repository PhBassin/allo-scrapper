import { render, screen, fireEvent } from '@testing-library/react';
import ScrollToTop from './ScrollToTop';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ScrollToTop', () => {
  beforeEach(() => {
    // Mock window.scrollTo
    window.scrollTo = vi.fn();
    // Reset scroll position
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not render button when scroll position is less than 200px', () => {
    render(<ScrollToTop />);
    
    // Button should not be visible initially
    const button = screen.queryByRole('button', { name: /retour en haut/i });
    expect(button).not.toBeInTheDocument();
  });

  it('should render button when scroll position is greater than 200px', () => {
    render(<ScrollToTop />);
    
    // Simulate scroll past 200px
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 250,
    });
    fireEvent.scroll(window);

    // Button should be visible
    const button = screen.getByRole('button', { name: /retour en haut/i });
    expect(button).toBeInTheDocument();
  });

  it('should hide button when scrolling back to top', () => {
    render(<ScrollToTop />);
    
    // Scroll down
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 300,
    });
    fireEvent.scroll(window);

    const button = screen.getByRole('button', { name: /retour en haut/i });
    expect(button).toBeInTheDocument();

    // Scroll back to top
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 50,
    });
    fireEvent.scroll(window);

    // Button should be hidden
    const hiddenButton = screen.queryByRole('button', { name: /retour en haut/i });
    expect(hiddenButton).not.toBeInTheDocument();
  });

  it('should scroll to top with smooth behavior when clicked', () => {
    render(<ScrollToTop />);
    
    // Simulate scroll past 200px
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 500,
    });
    fireEvent.scroll(window);

    const button = screen.getByRole('button', { name: /retour en haut/i });
    fireEvent.click(button);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('should have proper ARIA label for accessibility', () => {
    render(<ScrollToTop />);
    
    // Scroll to make button visible
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 300,
    });
    fireEvent.scroll(window);

    const button = screen.getByRole('button', { name: /retour en haut/i });
    expect(button).toHaveAttribute('aria-label', 'Retour en haut');
  });
});
