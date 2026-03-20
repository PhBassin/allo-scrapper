import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressTracker, type ProgressEvent } from './progress-tracker.js';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create a mock Response object
  const createMockResponse = () => ({
    write: vi.fn(),
    end: vi.fn(),
  });

  describe('addListener', () => {
    it('should add a listener and send existing events', () => {
      const mockRes = createMockResponse();
      const event: ProgressEvent = { type: 'started', total_cinemas: 5, total_dates: 7 };

      // Emit event before adding listener
      tracker.emit(event);

      // Add listener - should receive the existing event
      tracker.addListener(mockRes as any);

      expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify(event)}\n\n`);
      expect(tracker.getListenerCount()).toBe(1);
    });

    it('should start heartbeat when first listener is added', () => {
      const mockRes = createMockResponse();

      tracker.addListener(mockRes as any);

      // Advance timer to trigger heartbeat
      vi.advanceTimersByTime(15000);

      expect(mockRes.write).toHaveBeenCalledWith(': heartbeat\n\n');
    });
  });

  describe('removeListener', () => {
    it('should remove a listener', () => {
      const mockRes = createMockResponse();

      tracker.addListener(mockRes as any);
      expect(tracker.getListenerCount()).toBe(1);

      tracker.removeListener(mockRes as any);
      expect(tracker.getListenerCount()).toBe(0);
    });

    it('should stop heartbeat when last listener is removed', () => {
      const mockRes = createMockResponse();

      tracker.addListener(mockRes as any);
      tracker.removeListener(mockRes as any);

      // Advance timer - heartbeat should not fire
      vi.advanceTimersByTime(15000);

      // Only the initial replay call, no heartbeat
      expect(mockRes.write).not.toHaveBeenCalledWith(': heartbeat\n\n');
    });
  });

  describe('emit', () => {
    it('should emit event to all listeners', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const event: ProgressEvent = { type: 'cinema_started', cinema_name: 'Test', cinema_id: 'C1', index: 0 };

      tracker.addListener(mockRes1 as any);
      tracker.addListener(mockRes2 as any);

      tracker.emit(event);

      expect(mockRes1.write).toHaveBeenCalledWith(`data: ${JSON.stringify(event)}\n\n`);
      expect(mockRes2.write).toHaveBeenCalledWith(`data: ${JSON.stringify(event)}\n\n`);
    });

    it('should store events for replay to new listeners', () => {
      const event1: ProgressEvent = { type: 'started', total_cinemas: 3, total_dates: 7 };
      const event2: ProgressEvent = { type: 'cinema_started', cinema_name: 'Cinema A', cinema_id: 'C1', index: 0 };

      tracker.emit(event1);
      tracker.emit(event2);

      expect(tracker.getEvents()).toEqual([event1, event2]);
    });

    it('should remove disconnected listener on write error', () => {
      const mockRes = createMockResponse();
      mockRes.write.mockImplementation(() => {
        throw new Error('Connection closed');
      });

      tracker.addListener(mockRes as any);
      expect(tracker.getListenerCount()).toBe(1);

      // Emit should handle the error and remove the listener
      tracker.emit({ type: 'started', total_cinemas: 1, total_dates: 1 });

      expect(tracker.getListenerCount()).toBe(0);
    });
  });

  describe('clearEvents', () => {
    it('should clear all events but keep listeners connected', () => {
      const mockRes = createMockResponse();
      const event: ProgressEvent = { type: 'started', total_cinemas: 5, total_dates: 7 };

      tracker.addListener(mockRes as any);
      tracker.emit(event);

      expect(tracker.getEvents()).toHaveLength(1);
      expect(tracker.getListenerCount()).toBe(1);

      // Clear events
      tracker.clearEvents();

      // Events should be cleared
      expect(tracker.getEvents()).toHaveLength(0);

      // Listener should still be connected
      expect(tracker.getListenerCount()).toBe(1);

      // Listener should NOT have received an end() call
      expect(mockRes.end).not.toHaveBeenCalled();

      // New events should still be delivered to the listener
      const newEvent: ProgressEvent = { type: 'cinema_started', cinema_name: 'New', cinema_id: 'C2', index: 0 };
      tracker.emit(newEvent);

      expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify(newEvent)}\n\n`);
    });
  });

  describe('reset', () => {
    it('should clear events and close all connections', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const event: ProgressEvent = { type: 'started', total_cinemas: 5, total_dates: 7 };

      tracker.addListener(mockRes1 as any);
      tracker.addListener(mockRes2 as any);
      tracker.emit(event);

      expect(tracker.getEvents()).toHaveLength(1);
      expect(tracker.getListenerCount()).toBe(2);

      // Full reset
      tracker.reset();

      // Events should be cleared
      expect(tracker.getEvents()).toHaveLength(0);

      // Listeners should be removed
      expect(tracker.getListenerCount()).toBe(0);

      // Listeners should have received end() calls
      expect(mockRes1.end).toHaveBeenCalled();
      expect(mockRes2.end).toHaveBeenCalled();
    });

    it('should stop heartbeat on reset', () => {
      const mockRes = createMockResponse();

      tracker.addListener(mockRes as any);
      tracker.reset();

      // Advance timer - heartbeat should not fire since we reset
      vi.advanceTimersByTime(15000);

      expect(mockRes.write).not.toHaveBeenCalledWith(': heartbeat\n\n');
    });

    it('should handle errors when closing listeners', () => {
      const mockRes = createMockResponse();
      mockRes.end.mockImplementation(() => {
        throw new Error('Already closed');
      });

      tracker.addListener(mockRes as any);

      // Should not throw
      expect(() => tracker.reset()).not.toThrow();
      expect(tracker.getListenerCount()).toBe(0);
    });
  });

  describe('getEvents', () => {
    it('should return a copy of events array', () => {
      const event: ProgressEvent = { type: 'started', total_cinemas: 1, total_dates: 1 };
      tracker.emit(event);

      const events = tracker.getEvents();
      events.push({ type: 'failed', error: 'test' });

      // Original should not be modified
      expect(tracker.getEvents()).toHaveLength(1);
    });
  });
});
