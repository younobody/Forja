/**
 * Phase 1: Session Management Tests
 * =================================
 *
 * Tests for workout session grouping, deduplication, and duration calculation
 * Critical for preventing duplicate saves and correct session aggregation
 */

import {
  registrosDaSessao,
  isDuplicateSession,
  removeSession,
  duracaoSessoes,
  ultimoTreinoTimestamp,
} from '../../src/sessionUtils.js';

describe('registrosDaSessao', () => {
  let mockRegistros;

  beforeEach(() => {
    mockRegistros = [
      {
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Agachamento',
      },
      {
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:05:00Z',
        exercicio: 'Leg Press',
      },
      {
        dia: 'B',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T14:00:00Z',
        exercicio: 'Supino',
      },
      {
        dia: 'A',
        data_treino: '2026-07-09',
        timestamp: '2026-07-09T10:00:00Z',
        exercicio: 'Agachamento',
      },
    ];
  });

  describe('basic filtering', () => {
    test('returns records matching day and date', () => {
      const result = registrosDaSessao('A', '2026-07-10', mockRegistros);
      expect(result).toHaveLength(2);
      expect(result.every(r => r.dia === 'A' && r.data_treino === '2026-07-10')).toBe(true);
    });

    test('returns different records for different day', () => {
      const resultA = registrosDaSessao('A', '2026-07-10', mockRegistros);
      const resultB = registrosDaSessao('B', '2026-07-10', mockRegistros);
      expect(resultA).toHaveLength(2);
      expect(resultB).toHaveLength(1);
    });

    test('returns different records for different date', () => {
      const result1 = registrosDaSessao('A', '2026-07-10', mockRegistros);
      const result2 = registrosDaSessao('A', '2026-07-09', mockRegistros);
      expect(result1).toHaveLength(2);
      expect(result2).toHaveLength(1);
    });
  });

  describe('case insensitivity', () => {
    test('treats lowercase day same as uppercase', () => {
      const resultUpper = registrosDaSessao('A', '2026-07-10', mockRegistros);
      const resultLower = registrosDaSessao('a', '2026-07-10', mockRegistros);
      expect(resultUpper).toEqual(resultLower);
    });

    test('works with mixed case', () => {
      const result = registrosDaSessao('a', '2026-07-10', mockRegistros);
      expect(result).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    test('returns empty array for no matches', () => {
      const result = registrosDaSessao('C', '2026-07-10', mockRegistros);
      expect(result).toEqual([]);
    });

    test('handles empty registros array', () => {
      const result = registrosDaSessao('A', '2026-07-10', []);
      expect(result).toEqual([]);
    });

    test('handles null registros', () => {
      const result = registrosDaSessao('A', '2026-07-10', null);
      expect(result).toEqual([]);
    });

    test('handles undefined registros', () => {
      const result = registrosDaSessao('A', '2026-07-10', undefined);
      expect(result).toEqual([]);
    });

    test('handles non-array registros', () => {
      const result = registrosDaSessao('A', '2026-07-10', 'not an array');
      expect(result).toEqual([]);
    });
  });

  describe('timestamp fallback (dataSessao integration)', () => {
    test('matches using timestamp if data_treino missing', () => {
      const regsWithTimestampOnly = [
        {
          dia: 'A',
          data_treino: '', // empty
          timestamp: '2026-07-10T10:00:00Z',
        },
        {
          dia: 'A',
          data_treino: '',
          timestamp: '2026-07-10T10:05:00Z',
        },
      ];
      const result = registrosDaSessao('A', '2026-07-10', regsWithTimestampOnly);
      // Both should match because dataSessao falls back to timestamp -> 2026-07-10
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

describe('isDuplicateSession', () => {
  let mockRegistros;

  beforeEach(() => {
    mockRegistros = [
      {
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Agachamento',
      },
      {
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:05:00Z',
        exercicio: 'Leg Press',
      },
    ];
  });

  test('returns true if session already has records', () => {
    const isDup = isDuplicateSession('A', '2026-07-10', mockRegistros);
    expect(isDup).toBe(true);
  });

  test('returns false if session is new', () => {
    const isDup = isDuplicateSession('C', '2026-07-10', mockRegistros);
    expect(isDup).toBe(false);
  });

  test('returns false if different date', () => {
    const isDup = isDuplicateSession('A', '2026-07-09', mockRegistros);
    expect(isDup).toBe(false);
  });

  test('handles empty registros', () => {
    const isDup = isDuplicateSession('A', '2026-07-10', []);
    expect(isDup).toBe(false);
  });
});

describe('removeSession', () => {
  let mockRegistros;

  beforeEach(() => {
    mockRegistros = [
      {
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Agachamento',
      },
      {
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:05:00Z',
        exercicio: 'Leg Press',
      },
      {
        dia: 'B',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T14:00:00Z',
        exercicio: 'Supino',
      },
      {
        dia: 'A',
        data_treino: '2026-07-09',
        timestamp: '2026-07-09T10:00:00Z',
        exercicio: 'Agachamento',
      },
    ];
  });

  test('removes all records from matching session', () => {
    const result = removeSession('A', '2026-07-10', mockRegistros);
    expect(result).toHaveLength(2); // Only B and old A remain
    expect(result.every(r => !(r.dia === 'A' && r.data_treino === '2026-07-10'))).toBe(true);
  });

  test('preserves other days', () => {
    const result = removeSession('A', '2026-07-10', mockRegistros);
    const bRecords = result.filter(r => r.dia === 'B');
    expect(bRecords).toHaveLength(1);
  });

  test('preserves other dates', () => {
    const result = removeSession('A', '2026-07-10', mockRegistros);
    const oldARecords = result.filter(r => r.dia === 'A' && r.data_treino === '2026-07-09');
    expect(oldARecords).toHaveLength(1);
  });

  test('returns all records if no match', () => {
    const result = removeSession('Z', '2026-07-10', mockRegistros);
    expect(result).toHaveLength(mockRegistros.length);
  });

  test('handles empty registros', () => {
    const result = removeSession('A', '2026-07-10', []);
    expect(result).toEqual([]);
  });
});

describe('duracaoSessoes', () => {
  test('calculates span from first to last save', () => {
    const regs = [
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:00:00Z' },
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:10:00Z' }, // 10min later
    ];
    const durations = duracaoSessoes(regs);
    expect(durations).toHaveLength(1);
    expect(durations[0]).toBe(10);
  });

  test('filters sessions with < 2 records', () => {
    const regs = [
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:00:00Z' }, // only 1
      { dia: 'B', data_treino: '2026-07-10', timestamp: '2026-07-10T14:00:00Z' },
      { dia: 'B', data_treino: '2026-07-10', timestamp: '2026-07-10T14:15:00Z' }, // 2 records
    ];
    const durations = duracaoSessoes(regs);
    expect(durations).toHaveLength(1); // Only B session
    expect(durations[0]).toBe(15);
  });

  test('rejects durations < 3 minutes', () => {
    const regs = [
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:00:00Z' },
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:02:00Z' }, // 2 min
    ];
    const durations = duracaoSessoes(regs);
    expect(durations).toHaveLength(0);
  });

  test('rejects durations > 5 hours', () => {
    const regs = [
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:00:00Z' },
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T15:30:00Z' }, // 330min = 5.5h
    ];
    const durations = duracaoSessoes(regs);
    expect(durations).toHaveLength(0);
  });

  test('accepts durations 3min to 5h', () => {
    const regs = [
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:00:00Z' },
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:45:00Z' }, // 45min
    ];
    const durations = duracaoSessoes(regs);
    expect(durations).toHaveLength(1);
    expect(durations[0]).toBe(45);
  });

  test('groups by day and date', () => {
    const regs = [
      // Session A on 2026-07-10
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:00:00Z' },
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:30:00Z' }, // 30min
      // Session B on 2026-07-10
      { dia: 'B', data_treino: '2026-07-10', timestamp: '2026-07-10T14:00:00Z' },
      { dia: 'B', data_treino: '2026-07-10', timestamp: '2026-07-10T14:45:00Z' }, // 45min
      // Session A on 2026-07-09
      { dia: 'A', data_treino: '2026-07-09', timestamp: '2026-07-09T10:00:00Z' },
      { dia: 'A', data_treino: '2026-07-09', timestamp: '2026-07-09T10:20:00Z' }, // 20min
    ];
    const durations = duracaoSessoes(regs);
    expect(durations).toHaveLength(3);
    expect(durations.sort()).toEqual([20, 30, 45]);
  });

  test('ignores invalid timestamps', () => {
    const regs = [
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:00:00Z' },
      { dia: 'A', data_treino: '2026-07-10', timestamp: 'invalid' },
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:30:00Z' },
    ];
    const durations = duracaoSessoes(regs);
    expect(durations).toHaveLength(1);
    expect(durations[0]).toBe(30);
  });

  test('handles empty array', () => {
    const durations = duracaoSessoes([]);
    expect(durations).toEqual([]);
  });

  test('handles null input', () => {
    const durations = duracaoSessoes(null);
    expect(durations).toEqual([]);
  });
});

describe('ultimoTreinoTimestamp', () => {
  test('returns most recent record', () => {
    const regs = [
      { dia: 'A', timestamp: '2026-07-10T10:00:00Z', exercicio: 'Agachamento' },
      { dia: 'A', timestamp: '2026-07-10T10:30:00Z', exercicio: 'Leg Press' },
      { dia: 'A', timestamp: '2026-07-10T10:20:00Z', exercicio: 'Extensora' },
    ];
    const result = ultimoTreinoTimestamp(regs);
    expect(result.exercicio).toBe('Leg Press');
  });

  test('returns null for empty array', () => {
    const result = ultimoTreinoTimestamp([]);
    expect(result).toBeNull();
  });

  test('handles invalid timestamps', () => {
    const regs = [
      { dia: 'A', timestamp: 'invalid', exercicio: 'Agachamento' },
      { dia: 'A', timestamp: '2026-07-10T10:00:00Z', exercicio: 'Leg Press' },
    ];
    const result = ultimoTreinoTimestamp(regs);
    expect(result.exercicio).toBe('Leg Press');
  });

  test('ignores all invalid timestamps', () => {
    const regs = [
      { dia: 'A', timestamp: 'invalid1', exercicio: 'Agachamento' },
      { dia: 'A', timestamp: 'invalid2', exercicio: 'Leg Press' },
    ];
    const result = ultimoTreinoTimestamp(regs);
    expect(result).toBeNull();
  });
});

describe('integration: session deduplication workflow', () => {
  test('detect duplicate and prevent save', () => {
    const existingRegistros = [
      {
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Agachamento',
      },
    ];

    const newDay = 'A';
    const newDate = '2026-07-10';

    // Check if duplicate
    const isDup = isDuplicateSession(newDay, newDate, existingRegistros);
    expect(isDup).toBe(true);

    // If duplicate, get existing records instead of saving
    const existing = registrosDaSessao(newDay, newDate, existingRegistros);
    expect(existing).toHaveLength(1);
  });

  test('detect new session and save', () => {
    const existingRegistros = [
      {
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Agachamento',
      },
    ];

    const newDay = 'B';
    const newDate = '2026-07-10';

    // Check if duplicate
    const isDup = isDuplicateSession(newDay, newDate, existingRegistros);
    expect(isDup).toBe(false);

    // Not a duplicate, can save
    expect(isDup).toBe(false);
  });

  test('overwrite workflow', () => {
    let registros = [
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:00:00Z', exercicio: 'Agachamento' },
      { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:05:00Z', exercicio: 'Leg Press' },
      { dia: 'B', data_treino: '2026-07-10', timestamp: '2026-07-10T14:00:00Z', exercicio: 'Supino' },
    ];

    const dayToOverwrite = 'A';
    const dateToOverwrite = '2026-07-10';

    // Remove old session
    registros = removeSession(dayToOverwrite, dateToOverwrite, registros);
    expect(registros).toHaveLength(1);

    // Add new records
    const newRecord = { dia: 'A', data_treino: '2026-07-10', timestamp: '2026-07-10T10:00:00Z', exercicio: 'Agachamento V2' };
    registros.push(newRecord);

    // Verify
    const session = registrosDaSessao(dayToOverwrite, dateToOverwrite, registros);
    expect(session).toHaveLength(1);
    expect(session[0].exercicio).toBe('Agachamento V2');
  });
});
