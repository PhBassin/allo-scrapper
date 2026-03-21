import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressTracker } from './progress-tracker';
import type { Response } from 'express';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;
  let mockResponse: Response;

  beforeEach(() => {
    tracker = new ProgressTracker();
    
    // Create a mock Response object with write method
    mockResponse = {
      write: vi.fn(),
      end: vi.fn(),
    } as unknown as Response;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('addListener', () => {
    it('should send immediate heartbeat when client connects', () => {
      // Act
      tracker.addListener(mockResponse);

      // Assert
      expect(mockResponse.write).toHaveBeenCalledWith(': heartbeat\n\n');
    });

    it('should replay historical events to new listeners', () => {
      // Arrange
      const event1 = { type: 'started' as const, total_cinemas: 5, total_dates: 7 };
      const event2 = { type: 'cinema_started' as const, cinema_name: 'Test Cinema', cinema_id: 'C001', index: 1 };
      
      tracker.emit(event1);
      tracker.emit(event2);

      // Act
      tracker.addListener(mockResponse);

      // Assert
      expect(mockResponse.write).toHaveBeenCalledWith(': heartbeat\n\n');
      expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify(event1)}\n\n`);
      expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify(event2)}\n\n`);
    });

    it('should not add listener if initial heartbeat fails', () => {
      // Arrange
      const failingResponse = {
        write: vi.fn().mockImplementation(() => {
          throw new Error('Connection closed');
        }),
      } as unknown as Response;

      // Act
      tracker.addListener(failingResponse);

      // Assert
      expect(tracker.getListenerCount()).toBe(0);
    });

    it('should start heartbeat interval for first listener', () => {
      vi.useFakeTimers();

      // Act
      tracker.addListener(mockResponse);

      // Assert - initial heartbeat sent immediately
      expect(mockResponse.write).toHaveBeenCalledWith(': heartbeat\n\n');
      
      // Clear the mock to test periodic heartbeats
      vi.mocked(mockResponse.write).mockClear();

      // Fast-forward time by 15 seconds
      vi.advanceTimersByTime(15000);

      // Assert - periodic heartbeat sent
      expect(mockResponse.write).toHaveBeenCalledWith(': heartbeat\n\n');

      vi.useRealTimers();
    });
  });

  describe('removeListener', () => {
    it('should stop heartbeat when last listener disconnects', () => {
      vi.useFakeTimers();

      // Arrange
      tracker.addListener(mockResponse);
      vi.mocked(mockResponse.write).mockClear();

      // Act - remove the only listener
      tracker.removeListener(mockResponse);

      // Fast-forward time
      vi.advanceTimersByTime(15000);

      // Assert - no heartbeat should be sent after removal
      expect(mockResponse.write).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('emit', () => {
    it('should send event to all connected listeners', () => {
      // Arrange
      const mockResponse2 = {
        write: vi.fn(),
        end: vi.fn(),
      } as unknown as Response;

      tracker.addListener(mockResponse);
      tracker.addListener(mockResponse2);

      const event = { type: 'started' as const, total_cinemas: 5, total_dates: 7 };

      // Clear initial heartbeats
      vi.mocked(mockResponse.write).mockClear();
      vi.mocked(mockResponse2.write).mockClear();

      // Act
      tracker.emit(event);

      // Assert
      expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify(event)}\n\n`);
      expect(mockResponse2.write).toHaveBeenCalledWith(`data: ${JSON.stringify(event)}\n\n`);
    });

    it('should remove listener if write fails', () => {
      // Arrange
      tracker.addListener(mockResponse);
      
      // Make write fail on next call
      vi.mocked(mockResponse.write).mockImplementationOnce(() => {
        throw new Error('Connection closed');
      });

      const event = { type: 'started' as const, total_cinemas: 5, total_dates: 7 };

      // Act
      tracker.emit(event);

      // Assert
      expect(tracker.getListenerCount()).toBe(0);
    });
  });

  describe('getListenerCount', () => {
    it('should return correct number of listeners', () => {
      expect(tracker.getListenerCount()).toBe(0);

      tracker.addListener(mockResponse);
      expect(tracker.getListenerCount()).toBe(1);

      const mockResponse2 = {
        write: vi.fn(),
        end: vi.fn(),
      } as unknown as Response;
      tracker.addListener(mockResponse2);
      expect(tracker.getListenerCount()).toBe(2);

      tracker.removeListener(mockResponse);
      expect(tracker.getListenerCount()).toBe(1);
    });
  });

  describe('reset', () => {
    it('should clear events and close all connections', () => {
      // Arrange
      const event = { type: 'started' as const, total_cinemas: 5, total_dates: 7 };
      tracker.emit(event);
      tracker.addListener(mockResponse);

      // Act
      tracker.reset();

      // Assert
      expect(mockResponse.end).toHaveBeenCalled();
      expect(tracker.getListenerCount()).toBe(0);

      // New listener should not receive historical events
      const mockResponse2 = {
        write: vi.fn(),
        end: vi.fn(),
      } as unknown as Response;
      tracker.addListener(mockResponse2);

      // Should only have initial heartbeat, not the historical event
      expect(mockResponse2.write).toHaveBeenCalledTimes(1);
      expect(mockResponse2.write).toHaveBeenCalledWith(': heartbeat\n\n');
    });
  });
});
