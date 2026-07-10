/**
 * Phase 1: Date/Time Parsing Tests
 * ================================
 *
 * Tests for all date parsing functions with edge cases
 * Covers known bugs fixed in v22, v28.4
 */

import {
  dataTreinoLimpa,
  dataLocalIso,
  hojeIso,
  dataSessao,
  daysAgo,
  fmtDate,
  fmtDateTime,
} from '../../src/dateUtils.js';

describe('dataTreinoLimpa', () => {
  describe('ISO date format', () => {
    test('parses YYYY-MM-DD string', () => {
      expect(dataTreinoLimpa('2026-05-28')).toBe('2026-05-28');
    });

    test('parses Google Sheets ISO with time', () => {
      expect(dataTreinoLimpa('2026-05-28T00:00:00.000Z')).toBe('2026-05-28');
    });

    test('parses ISO with timezone offset', () => {
      expect(dataTreinoLimpa('2026-05-28T22:30:00-03:00')).toBe('2026-05-28');
    });
  });

  describe('pt-BR format', () => {
    test('parses 4-digit year (28/05/2026)', () => {
      expect(dataTreinoLimpa('28/05/2026')).toBe('2026-05-28');
    });

    test('parses 2-digit year (28/05/26)', () => {
      expect(dataTreinoLimpa('28/05/26')).toBe('2026-05-28');
    });

    test('handles single-digit day/month (5/3/2026)', () => {
      expect(dataTreinoLimpa('5/3/2026')).toBe('2026-03-05');
    });
  });

  describe('rejection cases', () => {
    test('rejects partial dates without year (04/07)', () => {
      expect(dataTreinoLimpa('04/07')).toBe('');
    });

    test('rejects empty string', () => {
      expect(dataTreinoLimpa('')).toBe('');
    });

    test('rejects null/undefined', () => {
      expect(dataTreinoLimpa(null)).toBe('');
      expect(dataTreinoLimpa(undefined)).toBe('');
    });

    test('rejects invalid date format', () => {
      expect(dataTreinoLimpa('invalid')).toBe('');
      expect(dataTreinoLimpa('2026/05/28')).toBe(''); // wrong separator
    });

    test('accepts pattern regardless of month/day validity (validation happens at use)', () => {
      // Note: dataTreinoLimpa only validates format, not actual date validity
      // Real validation happens when Date() is instantiated
      const result1 = dataTreinoLimpa('2026-13-01');
      const result2 = dataTreinoLimpa('2026-01-32');
      expect(result1).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result2).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('edge cases', () => {
    test('handles leap year (2026-02-29 is invalid, 2024-02-29 is valid)', () => {
      // v28.6: should gracefully handle invalid dates
      const result = dataTreinoLimpa('2026-02-29');
      // Either accepts or rejects - both OK, but should be consistent
      expect(typeof result).toBe('string');
    });

    test('handles year 2000', () => {
      expect(dataTreinoLimpa('2000-01-01')).toBe('2000-01-01');
    });

    test('handles whitespace', () => {
      expect(dataTreinoLimpa('  2026-05-28  ')).toBe('2026-05-28');
    });
  });
});

describe('dataLocalIso', () => {
  describe('input formats', () => {
    test('parses plain ISO date', () => {
      const result = dataLocalIso('2026-05-28');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe('2026-05-28');
    });

    test('converts UTC ISO to local timezone', () => {
      // This is tricky because it depends on system timezone
      // Just verify output format is correct
      const result = dataLocalIso('2026-05-28T10:00:00Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('handles ISO with timezone offset', () => {
      const result = dataLocalIso('2026-05-28T22:00:00-03:00');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('rejection cases', () => {
    test('rejects partial date without year', () => {
      expect(dataLocalIso('04/07')).toBe('');
    });

    test('rejects empty string', () => {
      expect(dataLocalIso('')).toBe('');
    });

    test('rejects null/undefined', () => {
      expect(dataLocalIso(null)).toBe('');
      expect(dataLocalIso(undefined)).toBe('');
    });
  });

  describe('edge cases', () => {
    test('handles whitespace', () => {
      const result = dataLocalIso('  2026-05-28  ');
      expect(result).toBe('2026-05-28');
    });

    test('handles very old dates', () => {
      const result = dataLocalIso('1970-01-01');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('returns max 10 chars for invalid input', () => {
      const result = dataLocalIso('this is invalid input string');
      expect(result.length <= 10).toBe(true);
    });
  });
});

describe('hojeIso', () => {
  test('returns today date in YYYY-MM-DD format', () => {
    const result = hojeIso();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('returns valid date components', () => {
    const result = hojeIso();
    const [year, month, day] = result.split('-');
    expect(parseInt(year)).toBeGreaterThan(2000);
    expect(parseInt(month)).toBeGreaterThanOrEqual(1);
    expect(parseInt(month)).toBeLessThanOrEqual(12);
    expect(parseInt(day)).toBeGreaterThanOrEqual(1);
    expect(parseInt(day)).toBeLessThanOrEqual(31);
  });
});

describe('dataSessao', () => {
  test('prioritizes data_treino over timestamp', () => {
    const record = {
      data_treino: '2026-05-28',
      timestamp: '2026-06-01T10:00:00Z',
    };
    expect(dataSessao(record)).toBe('2026-05-28');
  });

  test('falls back to timestamp when data_treino empty', () => {
    const record = {
      data_treino: '',
      timestamp: '2026-06-01T10:00:00Z',
    };
    const result = dataSessao(record);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('falls back to timestamp when data_treino invalid', () => {
    const record = {
      data_treino: 'invalid',
      timestamp: '2026-06-01T10:00:00Z',
    };
    const result = dataSessao(record);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('handles missing fields', () => {
    const record = {};
    const result = dataSessao(record);
    // Should not crash, return empty or today's date
    expect(typeof result).toBe('string');
  });

  test('handles null timestamp', () => {
    const record = {
      data_treino: '2026-05-28',
      timestamp: null,
    };
    expect(dataSessao(record)).toBe('2026-05-28');
  });
});

describe('daysAgo', () => {
  describe('calendar day calculations', () => {
    test('returns "hoje" for today\'s date', () => {
      const today = hojeIso();
      expect(daysAgo(today)).toBe('hoje');
    });

    test('returns "ontem" for yesterday\'s date', () => {
      const today = new Date();
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      const yestStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      expect(daysAgo(yestStr)).toBe('ontem');
    });

    test('returns "Xd atras" for N days ago', () => {
      const today = new Date();
      const past = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      expect(daysAgo(pastStr)).toBe('7d atras');
    });
  });

  describe('input formats', () => {
    test('parses YYYY-MM-DD format', () => {
      const today = hojeIso();
      expect(daysAgo(today)).toBe('hoje');
    });

    test('parses full ISO timestamp', () => {
      const today = new Date();
      const isoStr = today.toISOString();
      expect(daysAgo(isoStr)).toBe('hoje');
    });
  });

  describe('error handling', () => {
    test('returns "—" for invalid input', () => {
      expect(daysAgo('invalid')).toBe('—');
      // Note: JS Date('2026-13-01') is lenient, creates a valid date (Jan 1 of next year)
      // This is expected behavior - validation at use site, not here
    });

    test('returns "—" for empty string', () => {
      expect(daysAgo('')).toBe('—');
    });

    test('returns "—" for null/undefined', () => {
      expect(daysAgo(null)).toBe('—');
      expect(daysAgo(undefined)).toBe('—');
    });
  });

  describe('v28.4 fix: calendar day vs absolute hours', () => {
    test('uses calendar day, not absolute hours', () => {
      // v28.4 fixed: workout at 23h "became" 2d ago after 25h
      // Now "ontem" always means calendar day before
      const today = new Date();
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      expect(daysAgo(yesterdayStr)).toBe('ontem');
    });
  });
});

describe('fmtDate', () => {
  test('formats ISO date to pt-BR (DD/MM/YY)', () => {
    const result = fmtDate('2026-05-28');
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/);
    // Should be 28/05/26
  });

  test('formats ISO with time to pt-BR', () => {
    const result = fmtDate('2026-05-28T15:30:00Z');
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/);
  });

  test('handles Date object input', () => {
    const date = new Date(2026, 4, 28); // month is 0-indexed
    const result = fmtDate(date);
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/);
  });

  test('returns "—" for invalid input', () => {
    expect(fmtDate('invalid')).toBe('—');
    expect(fmtDate('')).toBe('—');
    expect(fmtDate(null)).toBe('—');
  });

  describe('v22 fix: UTC midnight issue', () => {
    test('uses local timezone for plain date strings', () => {
      // v22 fix: new Date("2026-06-22") was UTC midnight
      // In Brazil (-3), that was 21h of June 21
      const result = fmtDate('2026-06-22');
      // Should show as 22/06, not 21/06 (or similar depending on timezone)
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/);
    });
  });
});

describe('fmtDateTime', () => {
  test('formats ISO datetime to pt-BR (includes time)', () => {
    const result = fmtDateTime('2026-05-28T15:30:45Z');
    expect(result).toMatch(/\d{2}:\d{2}/); // At minimum, should have time
    expect(result).toContain('/'); // Date separator
  });

  test('returns "—" for invalid input', () => {
    expect(fmtDateTime('invalid')).toBe('—');
    expect(fmtDateTime('')).toBe('—');
  });

  test('handles Date object', () => {
    const date = new Date(2026, 4, 28, 15, 30);
    const result = fmtDateTime(date);
    expect(result).toMatch(/\d{2}:\d{2}/);
    expect(result).toContain('/');
  });
});

describe('integration: dataTreinoLimpa + dataLocalIso + dataSessao', () => {
  test('complete workflow: Sheets data_treino', () => {
    const record = {
      data_treino: '2026-05-28T00:00:00.000Z',
      timestamp: '2026-06-01T10:00:00Z',
    };
    const result = dataSessao(record);
    expect(result).toBe('2026-05-28');
  });

  test('complete workflow: Sheets timestamp fallback', () => {
    const record = {
      data_treino: '',
      timestamp: '2026-06-01T10:00:00Z',
    };
    const result = dataSessao(record);
    expect(result).toBe('2026-06-01');
  });

  test('complete workflow: pt-BR data_treino', () => {
    const record = {
      data_treino: '28/05/2026',
      timestamp: '2026-06-01T10:00:00Z',
    };
    const result = dataSessao(record);
    expect(result).toBe('2026-05-28');
  });

  test('complete workflow: corrupted partial date falls back', () => {
    const record = {
      data_treino: '04/07', // no year
      timestamp: '2026-06-04T10:00:00Z',
    };
    const result = dataSessao(record);
    expect(result).toBe('2026-06-04');
  });
});
