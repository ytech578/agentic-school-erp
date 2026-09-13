import {
  formatCurrencyINR,
  formatDate,
  formatTimeAgo,
  getGradeBadge,
  getAttendanceStatusBadge,
  getGreeting,
} from './formatters';

describe('Web Formatters (FIX-04)', () => {
  describe('formatCurrencyINR', () => {
    it('formats numeric values into Indian Rupee currency representations', () => {
      const formatted = formatCurrencyINR(50000);
      expect(formatted).toContain('50,000');
      expect(formatted).toContain('₹');
    });

    it('gracefully handles null and undefined', () => {
      expect(formatCurrencyINR(null)).toContain('0');
      expect(formatCurrencyINR(undefined)).toContain('0');
    });
  });

  describe('getGradeBadge', () => {
    it('calculates letter grades correctly based on percentage', () => {
      expect(getGradeBadge(95, 100).grade).toBe('A+');
      expect(getGradeBadge(85, 100).grade).toBe('A');
      expect(getGradeBadge(75, 100).grade).toBe('B');
      expect(getGradeBadge(65, 100).grade).toBe('C');
      expect(getGradeBadge(55, 100).grade).toBe('D');
      expect(getGradeBadge(40, 100).grade).toBe('E');
      expect(getGradeBadge(20, 100).grade).toBe('F');
    });

    it('returns fallback badge when maxScore is zero or negative', () => {
      expect(getGradeBadge(50, 0).grade).toBe('-');
    });
  });

  describe('getAttendanceStatusBadge', () => {
    it('returns appropriate badge configuration for each status', () => {
      expect(getAttendanceStatusBadge('PRESENT').label).toBe('Present');
      expect(getAttendanceStatusBadge('ABSENT').label).toBe('Absent');
      expect(getAttendanceStatusBadge('LATE').label).toBe('Late');
      expect(getAttendanceStatusBadge('HALF_DAY').label).toBe('Half Day');
    });
  });

  describe('formatDate', () => {
    it('formats ISO dates reliably', () => {
      const result = formatDate('2026-05-15T00:00:00.000Z');
      expect(result).toMatch(/15\s+(May|05)\s+2026/i);
    });

    it('returns placeholder on null date', () => {
      expect(formatDate(null)).toBe('—');
    });
  });

  describe('getGreeting', () => {
    it('returns a non-empty greeting string', () => {
      const greeting = getGreeting();
      expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(greeting);
    });
  });
});
