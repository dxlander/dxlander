import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatRelativeTimeFull,
} from '../../../../../packages/shared/src/utils/date';

describe('Date Utilities', () => {
  beforeEach(() => {
    // Mock the current time to ensure consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    it('should format Date object to absolute date string', () => {
      const date = new Date('2024-01-01T10:30:00Z');
      expect(formatDate(date)).toBe('Jan 1, 2024');
    });

    it('should format string date to absolute date string', () => {
      expect(formatDate('2024-01-01')).toBe('Jan 1, 2024');
    });

    it('should format timestamp to absolute date string', () => {
      const timestamp = new Date('2024-01-01').getTime();
      expect(formatDate(timestamp)).toBe('Jan 1, 2024');
    });
  });

  describe('formatDateTime', () => {
    it('should format Date object with time', () => {
      const date = new Date('2024-01-01T14:30:00Z');
      const result = formatDateTime(date);
      // Note: Time format may vary by timezone, so we check for expected components
      expect(result).toMatch(/Jan 1, 2024/);
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "Just now" for very recent dates', () => {
      const date = new Date('2024-01-15T11:59:30Z'); // 30 seconds ago
      expect(formatRelativeTime(date)).toBe('Just now');
    });

    it('should format minutes ago', () => {
      const date = new Date('2024-01-15T11:45:00Z'); // 15 minutes ago
      expect(formatRelativeTime(date)).toBe('15m ago');
    });

    it('should format hours ago', () => {
      const date = new Date('2024-01-15T10:00:00Z'); // 2 hours ago
      expect(formatRelativeTime(date)).toBe('2h ago');
    });

    it('should format days ago', () => {
      const date = new Date('2024-01-13T12:00:00Z'); // 2 days ago
      expect(formatRelativeTime(date)).toBe('2d ago');
    });
  });

  describe('formatRelativeTimeFull', () => {
    it('should return "Just now" for very recent dates', () => {
      const date = new Date('2024-01-15T11:59:30Z'); // 30 seconds ago
      expect(formatRelativeTimeFull(date)).toBe('Just now');
    });

    it('should format single minute ago', () => {
      const date = new Date('2024-01-15T11:59:00Z'); // 1 minute ago
      expect(formatRelativeTimeFull(date)).toBe('1 minute ago');
    });

    it('should format multiple minutes ago', () => {
      const date = new Date('2024-01-15T11:45:00Z'); // 15 minutes ago
      expect(formatRelativeTimeFull(date)).toBe('15 minutes ago');
    });

    it('should format single hour ago', () => {
      const date = new Date('2024-01-15T11:00:00Z'); // 1 hour ago
      expect(formatRelativeTimeFull(date)).toBe('1 hour ago');
    });

    it('should format multiple hours ago', () => {
      const date = new Date('2024-01-15T10:00:00Z'); // 2 hours ago
      expect(formatRelativeTimeFull(date)).toBe('2 hours ago');
    });

    it('should format single day ago', () => {
      const date = new Date('2024-01-14T12:00:00Z'); // 1 day ago
      expect(formatRelativeTimeFull(date)).toBe('1 day ago');
    });

    it('should format multiple days ago', () => {
      const date = new Date('2024-01-13T12:00:00Z'); // 2 days ago
      expect(formatRelativeTimeFull(date)).toBe('2 days ago');
    });
  });

  describe('Edge Cases', () => {
    describe('Invalid Dates', () => {
      it('should throw error for invalid date string in formatDate', () => {
        expect(() => formatDate('invalid-date')).toThrow('Invalid date provided');
      });

      it('should throw error for invalid date string in formatDateTime', () => {
        expect(() => formatDateTime('invalid-date')).toThrow('Invalid date provided');
      });

      it('should throw error for invalid date string in formatRelativeTime', () => {
        expect(() => formatRelativeTime('invalid-date')).toThrow('Invalid date provided');
      });

      it('should throw error for invalid date string in formatRelativeTimeFull', () => {
        expect(() => formatRelativeTimeFull('invalid-date')).toThrow('Invalid date provided');
      });

      it('should throw error for NaN timestamp', () => {
        expect(() => formatDate(NaN)).toThrow('Invalid date provided');
      });
    });

    describe('Future Dates', () => {
      it('should handle future dates in formatRelativeTime', () => {
        const futureDate = new Date('2024-01-16T12:00:00Z'); // 1 day in future
        // Future dates will show negative values, but function still works
        const result = formatRelativeTime(futureDate);
        expect(result).toBeDefined();
      });

      it('should handle future dates in formatRelativeTimeFull', () => {
        const futureDate = new Date('2024-01-16T12:00:00Z'); // 1 day in future
        // Future dates will show negative values, but function still works
        const result = formatRelativeTimeFull(futureDate);
        expect(result).toBeDefined();
      });
    });

    describe('Very Old Dates', () => {
      it('should format dates from years ago', () => {
        const oldDate = new Date('2020-01-01T12:00:00Z');
        expect(formatDate(oldDate)).toBe('Jan 1, 2020');
      });

      it('should format relative time for very old dates', () => {
        const oldDate = new Date('2023-01-01T12:00:00Z'); // ~380 days ago from test date
        const result = formatRelativeTime(oldDate);
        expect(result).toMatch(/\d+d ago/);
      });
    });

    describe('Different Input Types', () => {
      it('should handle Date object in formatDate', () => {
        const date = new Date('2024-01-01T00:00:00Z');
        expect(formatDate(date)).toBe('Jan 1, 2024');
      });

      it('should handle ISO string in formatDate', () => {
        expect(formatDate('2024-01-01T00:00:00Z')).toBe('Jan 1, 2024');
      });

      it('should handle timestamp number in formatDate', () => {
        const timestamp = new Date('2024-01-01T00:00:00Z').getTime();
        expect(formatDate(timestamp)).toBe('Jan 1, 2024');
      });

      it('should handle short date string', () => {
        expect(formatDate('2024-01-01')).toBe('Jan 1, 2024');
      });
    });

    describe('Boundary Cases', () => {
      it('should handle exactly 1 minute ago', () => {
        const date = new Date('2024-01-15T11:59:00Z');
        expect(formatRelativeTime(date)).toBe('1m ago');
        expect(formatRelativeTimeFull(date)).toBe('1 minute ago');
      });

      it('should handle exactly 1 hour ago', () => {
        const date = new Date('2024-01-15T11:00:00Z');
        expect(formatRelativeTime(date)).toBe('1h ago');
        expect(formatRelativeTimeFull(date)).toBe('1 hour ago');
      });

      it('should handle exactly 1 day ago', () => {
        const date = new Date('2024-01-14T12:00:00Z');
        expect(formatRelativeTime(date)).toBe('1d ago');
        expect(formatRelativeTimeFull(date)).toBe('1 day ago');
      });

      it('should handle 59 minutes ago (should show minutes, not hours)', () => {
        const date = new Date('2024-01-15T11:01:00Z'); // 59 minutes ago
        expect(formatRelativeTime(date)).toBe('59m ago');
        expect(formatRelativeTimeFull(date)).toBe('59 minutes ago');
      });

      it('should handle 23 hours ago (should show hours, not days)', () => {
        const date = new Date('2024-01-14T13:00:00Z'); // 23 hours ago
        expect(formatRelativeTime(date)).toBe('23h ago');
        expect(formatRelativeTimeFull(date)).toBe('23 hours ago');
      });
    });
  });
});
