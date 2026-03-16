/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Component that throws an error for testing ErrorBoundary
 */
const ThrowError = ({ message = 'Test error' }: { message?: string }) => {
  throw new Error(message);
};

/**
 * Component that works normally
 */
const NormalComponent = () => <div>Normal content</div>;

describe('ErrorBoundary', () => {
  // Suppress console.error for tests to avoid cluttering test output
  const originalError = console.error;
  
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <NormalComponent />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('should render multiple children without errors', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error UI when child component throws', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('should display custom error message', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Custom error message" />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    it('should display generic message if error has no message', () => {
      const ThrowEmptyError = () => {
        throw new Error();
      };

      render(
        <ErrorBoundary>
          <ThrowEmptyError />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
    });

    it('should have a reload button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      
      const reloadButton = screen.getByRole('button', { name: /reload page/i });
      expect(reloadButton).toBeInTheDocument();
    });

    it('should call window.location.reload when reload button is clicked', () => {
      // Mock window.location.reload
      const reloadMock = vi.fn();
      delete (window as any).location;
      (window as any).location = { reload: reloadMock };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      
      const reloadButton = screen.getByRole('button', { name: /reload page/i });
      fireEvent.click(reloadButton);
      
      expect(reloadMock).toHaveBeenCalled();
    });
  });

  describe('Error Logging', () => {
    it('should log error to console when catching it', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      
      render(
        <ErrorBoundary>
          <ThrowError message="Logged error" />
        </ErrorBoundary>
      );
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      // Check that the error was logged with 'ErrorBoundary caught:' prefix
      const errorCall = consoleErrorSpy.mock.calls.find(call => 
        call[0] === 'ErrorBoundary caught:'
      );
      expect(errorCall).toBeDefined();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Visual Appearance', () => {
    it('should have proper styling classes for error UI', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      
      // Check for Tailwind classes
      expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
      expect(container.querySelector('.bg-gray-50')).toBeInTheDocument();
      expect(container.querySelector('.bg-white')).toBeInTheDocument();
    });

    it('should display error in red color', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      
      const heading = screen.getByText('Something went wrong');
      expect(heading).toHaveClass('text-red-600');
    });
  });
});
