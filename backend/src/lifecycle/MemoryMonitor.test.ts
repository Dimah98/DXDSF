/**
 * Tests for MemoryMonitor
 *
 * Covers:
 * - checkMemoryUsage: returns MemoryStats from process.memoryUsage()
 * - limitNodeRuntimeState: warns at >5000 entries, evicts FIFO at >10000
 * - reportMemoryStats: logs memory info and optionally checks sessions
 * - Periodic reporting timer fires every 30 minutes
 * - stopReportingTimer: stops the periodic interval
 *
 * Requirement 11: Memory Usage Monitoring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryMonitor } from './MemoryMonitor';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a Map<string, any> with `count` entries.
 * Keys are '0', '1', ..., 'count-1' in insertion order.
 */
function buildMap(count: number): Map<string, any> {
  const map = new Map<string, any>();
  for (let i = 0; i < count; i++) {
    map.set(String(i), { value: i });
  }
  return map;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new MemoryMonitor();
  });

  afterEach(() => {
    monitor.stopReportingTimer();
    vi.useRealTimers();
  });

  // ── checkMemoryUsage ────────────────────────────────────────────────────

  describe('checkMemoryUsage', () => {
    it('returns an object with heapUsed, heapTotal, external, rss', () => {
      const stats = monitor.checkMemoryUsage();

      expect(stats).toHaveProperty('heapUsed');
      expect(stats).toHaveProperty('heapTotal');
      expect(stats).toHaveProperty('external');
      expect(stats).toHaveProperty('rss');
    });

    it('returns numeric values for all fields', () => {
      const stats = monitor.checkMemoryUsage();

      expect(typeof stats.heapUsed).toBe('number');
      expect(typeof stats.heapTotal).toBe('number');
      expect(typeof stats.external).toBe('number');
      expect(typeof stats.rss).toBe('number');
    });

    it('returns positive values', () => {
      const stats = monitor.checkMemoryUsage();

      expect(stats.heapUsed).toBeGreaterThan(0);
      expect(stats.heapTotal).toBeGreaterThan(0);
      expect(stats.rss).toBeGreaterThan(0);
    });

    it('reflects process.memoryUsage() values', () => {
      const raw = process.memoryUsage();
      const stats = monitor.checkMemoryUsage();

      // Values should be in the same ballpark (within 10 MB) since they are
      // read in quick succession during the test.
      const tolerance = 10 * 1024 * 1024; // 10 MB
      expect(Math.abs(stats.heapUsed - raw.heapUsed)).toBeLessThan(tolerance);
      expect(Math.abs(stats.heapTotal - raw.heapTotal)).toBeLessThan(tolerance);
      expect(Math.abs(stats.rss - raw.rss)).toBeLessThan(tolerance);
    });
  });

  // ── limitNodeRuntimeState ───────────────────────────────────────────────

  describe('limitNodeRuntimeState', () => {
    it('does not modify a map below the warning threshold (5000)', () => {
      const map = buildMap(100);
      monitor.limitNodeRuntimeState(map);
      expect(map.size).toBe(100);
    });

    it('does not evict entries when size is exactly at the warning threshold (5000)', () => {
      const map = buildMap(5000);
      monitor.limitNodeRuntimeState(map);
      expect(map.size).toBe(5000);
    });

    it('does not evict entries when size is between 5001 and 10000', () => {
      const map = buildMap(7500);
      monitor.limitNodeRuntimeState(map);
      expect(map.size).toBe(7500);
    });

    it('does not evict entries when size is exactly at the hard limit (10000)', () => {
      const map = buildMap(10000);
      monitor.limitNodeRuntimeState(map);
      expect(map.size).toBe(10000);
    });

    it('evicts entries when size exceeds 10000, leaving exactly 10000', () => {
      const map = buildMap(10500);
      monitor.limitNodeRuntimeState(map);
      expect(map.size).toBe(10000);
    });

    it('evicts the OLDEST entries first (FIFO)', () => {
      // Build a map with keys '0' through '10009' (10010 entries)
      const map = buildMap(10010);

      monitor.limitNodeRuntimeState(map);

      // The 10 oldest keys ('0' through '9') should have been removed
      for (let i = 0; i < 10; i++) {
        expect(map.has(String(i))).toBe(false);
      }

      // The 10000 newest keys ('10' through '10009') should remain
      expect(map.has('10')).toBe(true);
      expect(map.has('10009')).toBe(true);
    });

    it('respects a custom maxSize parameter', () => {
      const map = buildMap(600);
      monitor.limitNodeRuntimeState(map, 500);
      expect(map.size).toBe(500);
    });

    it('evicts FIFO with a custom maxSize', () => {
      const map = buildMap(110);
      monitor.limitNodeRuntimeState(map, 100);

      // Oldest 10 entries ('0' through '9') should be gone
      for (let i = 0; i < 10; i++) {
        expect(map.has(String(i))).toBe(false);
      }
      expect(map.has('10')).toBe(true);
      expect(map.has('109')).toBe(true);
    });

    it('handles an empty map without throwing', () => {
      const map = new Map<string, any>();
      expect(() => monitor.limitNodeRuntimeState(map)).not.toThrow();
      expect(map.size).toBe(0);
    });
  });

  // ── reportMemoryStats ───────────────────────────────────────────────────

  describe('reportMemoryStats', () => {
    it('does not throw when called without sessions', () => {
      expect(() => monitor.reportMemoryStats()).not.toThrow();
    });

    it('does not throw when called with an empty sessions iterable', () => {
      expect(() => monitor.reportMemoryStats([])).not.toThrow();
    });

    it('calls limitNodeRuntimeState for each provided session map', () => {
      const spy = vi.spyOn(monitor, 'limitNodeRuntimeState');

      const map1 = buildMap(50);
      const map2 = buildMap(100);

      monitor.reportMemoryStats([map1, map2]);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(map1);
      expect(spy).toHaveBeenCalledWith(map2);
    });

    it('evicts oversized session maps during reporting', () => {
      const oversized = buildMap(10100);
      monitor.reportMemoryStats([oversized]);
      expect(oversized.size).toBe(10000);
    });
  });

  // ── periodic reporting timer ────────────────────────────────────────────

  describe('periodic reporting timer', () => {
    it('getReportIntervalMs returns 30 minutes in milliseconds', () => {
      expect(monitor.getReportIntervalMs()).toBe(30 * 60 * 1000);
    });

    it('calls reportMemoryStats after 30 minutes', () => {
      const spy = vi.spyOn(monitor, 'reportMemoryStats');

      vi.advanceTimersByTime(30 * 60 * 1000);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('calls reportMemoryStats multiple times over multiple intervals', () => {
      const spy = vi.spyOn(monitor, 'reportMemoryStats');

      vi.advanceTimersByTime(90 * 60 * 1000); // 3 × 30 minutes

      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('does not call reportMemoryStats before 30 minutes have elapsed', () => {
      const spy = vi.spyOn(monitor, 'reportMemoryStats');

      vi.advanceTimersByTime(29 * 60 * 1000 + 59 * 1000); // just under 30 min

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ── stopReportingTimer ──────────────────────────────────────────────────

  describe('stopReportingTimer', () => {
    it('stops the periodic timer so reportMemoryStats is no longer called', () => {
      const spy = vi.spyOn(monitor, 'reportMemoryStats');

      monitor.stopReportingTimer();

      vi.advanceTimersByTime(60 * 60 * 1000); // 2 × 30 minutes

      expect(spy).not.toHaveBeenCalled();
    });

    it('is safe to call multiple times', () => {
      expect(() => {
        monitor.stopReportingTimer();
        monitor.stopReportingTimer();
      }).not.toThrow();
    });
  });
});
