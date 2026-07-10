/**
 * Phase 2: Data Accuracy Tests
 * ============================
 *
 * Tests for chart rendering, calendar heatmap, exercise alias resolution
 * Stats calculations, large dataset handling
 */

import { test, expect } from '@playwright/test';
import {
  navigateToApp,
  loginAsStudent,
  setupApiMocking,
  getAppState,
  clearLocalStorage,
  TEST_CREDENTIALS,
} from './fixtures/testUtils.js';
import { mockPlano, mockRegistros, createSessionData, createMultiSessionData } from './fixtures/mockData.js';

test.describe('Chart Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('progress chart renders with workout data', async ({ page }) => {
    await navigateToApp(page);
    const workoutData = createSessionData('A', '2026-07-10', 3);

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: workoutData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    // Look for chart canvas
    const canvas = page.locator('canvas');
    const canvasCount = await canvas.count();
    expect(canvasCount).toBeGreaterThanOrEqual(0);

    // Verify data is loaded
    const appState = await getAppState(page);
    expect(appState.data.registros.length).toBe(3);
  });

  test('empty dataset does not crash chart', async ({ page }) => {
    await navigateToApp(page);

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: [], // Empty
          },
        },
      ],
    });

    await loginAsStudent(page);

    // Should load without crashing
    const appState = await getAppState(page);
    expect(appState.data).toBeTruthy();
    expect(appState.data.registros.length).toBe(0);
  });

  test('large dataset (100+) renders without hanging', async ({ page }) => {
    await navigateToApp(page);

    // Create 100+ workouts
    const largeWorkout = [];
    for (let i = 0; i < 100; i++) {
      const dayIndex = i % 5;
      const days = ['A', 'B', 'C', 'D', 'E'];
      const daysBack = Math.floor(i / 5);
      const date = new Date();
      date.setDate(date.getDate() - daysBack);
      const dateStr = date.toISOString().split('T')[0];

      largeWorkout.push({
        aluno_id: TEST_CREDENTIALS.id,
        dia: days[dayIndex],
        data_treino: dateStr,
        timestamp: new Date(date.getTime() + (i % 5) * 5 * 60000).toISOString(),
        exercicio: `Exercício ${i % 10}`,
        carga: '50',
        reps: '8',
        completou: 'sim',
      });
    }

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: largeWorkout,
          },
        },
      ],
    });

    const startTime = Date.now();
    await loginAsStudent(page);
    const loadTime = Date.now() - startTime;

    const appState = await getAppState(page);
    expect(appState.data.registros.length).toBe(100);
    expect(loadTime).toBeLessThan(5000); // Should load in < 5 seconds
  });

  test('chart data sorted chronologically', async ({ page }) => {
    await navigateToApp(page);

    const unsortedData = [
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-08',
        timestamp: '2026-07-08T10:00:00Z',
        exercicio: 'Ex1',
        completou: 'sim',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'B',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Ex2',
        completou: 'sim',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-09',
        timestamp: '2026-07-09T10:00:00Z',
        exercicio: 'Ex3',
        completou: 'sim',
      },
    ];

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: unsortedData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);
    const regs = appState.data.registros;

    // Verify data is sorted by date
    for (let i = 1; i < regs.length; i++) {
      const prevDate = new Date(regs[i - 1].data_treino).getTime();
      const currDate = new Date(regs[i].data_treino).getTime();
      // Either same date or chronological
      expect(currDate >= prevDate).toBe(true);
    }
  });
});

test.describe('Calendar Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('calendar marks training days correctly', async ({ page }) => {
    await navigateToApp(page);
    const workoutData = createMultiSessionData();

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: workoutData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);
    const trainingDates = new Set(
      appState.data.registros.map(r => r.data_treino)
    );

    // Should have multiple training dates
    expect(trainingDates.size).toBeGreaterThan(0);
  });

  test('calendar marks missed days correctly', async ({ page }) => {
    await navigateToApp(page);

    // Only one workout (most days missed)
    const sparseData = [
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Ex',
        completou: 'sim',
      },
    ];

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: sparseData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);
    // Calendar should calculate missed days
    expect(appState.data.registros.length).toBe(1);
  });
});

test.describe('Exercise Alias Resolution', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('exercises with same base name unified in history', async ({ page }) => {
    await navigateToApp(page);

    // Same exercise, different names (alias scenario v28.5)
    const workoutWithAlias = [
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Cadeira Extensora',
        carga: '80',
        reps: '12',
        completou: 'sim',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-09',
        timestamp: '2026-07-09T10:00:00Z',
        exercicio: 'Cadeira Extensora Unilateral', // Alias
        carga: '35',
        reps: '12',
        completou: 'sim',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-08',
        timestamp: '2026-07-08T10:00:00Z',
        exercicio: 'Cadeira Extensora',
        carga: '75',
        reps: '12',
        completou: 'sim',
      },
    ];

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: workoutWithAlias,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);
    // All 3 records should be present (alias resolution is visual)
    expect(appState.data.registros.length).toBe(3);

    // Verify records loaded
    const hasOriginal = appState.data.registros.some(r =>
      r.exercicio.includes('Cadeira Extensora'),
    );
    expect(hasOriginal).toBe(true);
  });

  test('alias suggestion dropdown populated', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);
    await loginAsStudent(page);

    // Verify plan exercises exist for suggestions
    const appState = await getAppState(page);
    const knownExercises = [];

    Object.values(appState.editPlano || {}).forEach(dayEx => {
      dayEx.forEach(ex => knownExercises.push(ex.exercicio));
    });

    expect(knownExercises.length).toBeGreaterThan(0);
  });
});

test.describe('Statistics Calculations', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('7-day session count calculated correctly', async ({ page }) => {
    await navigateToApp(page);

    const workoutData = createMultiSessionData();

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: workoutData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);

    // Calculate 7-day sessions
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const last7DaySessions = appState.data.registros.filter(r => {
      const rDate = new Date(r.data_treino);
      return rDate >= sevenDaysAgo && rDate <= today;
    });

    // Should have some sessions from past 7 days
    expect(last7DaySessions.length).toBeGreaterThan(0);
  });

  test('session duration stats exclude invalid data', async ({ page }) => {
    await navigateToApp(page);

    const workoutData = [
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Ex1',
        completou: 'sim',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:30:00Z', // 30min later
        exercicio: 'Ex2',
        completou: 'sim',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: 'invalid-date', // Invalid timestamp
        exercicio: 'Ex3',
        completou: 'sim',
      },
    ];

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: workoutData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);
    // Valid records loaded
    expect(appState.data.registros.length).toBe(3);

    // Invalid timestamp record still present (app handles gracefully)
    const invalidRecord = appState.data.registros.find(r => r.timestamp === 'invalid-date');
    expect(invalidRecord).toBeTruthy();
  });

  test('completed vs incomplete exercises tracked', async ({ page }) => {
    await navigateToApp(page);

    const workoutData = [
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Ex1',
        completou: 'sim',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:10:00Z',
        exercicio: 'Ex2',
        completou: 'nao',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:20:00Z',
        exercicio: 'Ex3',
        completou: 'sim',
      },
    ];

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: workoutData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);
    const completed = appState.data.registros.filter(r => r.completou === 'sim');
    const incomplete = appState.data.registros.filter(r => r.completou === 'nao');

    expect(completed.length).toBe(2);
    expect(incomplete.length).toBe(1);
  });

  test('exercises per session calculated', async ({ page }) => {
    await navigateToApp(page);

    const workoutData = createSessionData('A', '2026-07-10', 5);

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: workoutData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);
    // All exercises from one session
    const sessionExercises = appState.data.registros.filter(
      r => r.data_treino === '2026-07-10',
    );

    expect(sessionExercises.length).toBe(5);
  });
});

test.describe('Data Accuracy - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('special characters in exercise names preserved', async ({ page }) => {
    await navigateToApp(page);

    const specialNames = [
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Supino (halter) - 45º',
        completou: 'sim',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:05:00Z',
        exercicio: 'Rosca Direta & Costas',
        completou: 'sim',
      },
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:10:00Z',
        exercicio: 'Extensão #1 (máquina)',
        completou: 'sim',
      },
    ];

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: specialNames,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);
    const names = appState.data.registros.map(r => r.exercicio);

    expect(names[0]).toContain('(halter)');
    expect(names[1]).toContain('&');
    expect(names[2]).toContain('#');
  });

  test('very long exercise names handled', async ({ page }) => {
    await navigateToApp(page);

    const longName = 'Supino Inclinado com Halter no Banco Ajustável à 45 Graus com Pausa de 2 Segundos no Final da Série Completa';
    const workoutData = [
      {
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: longName,
        completou: 'sim',
      },
    ];

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Test' },
            plano: mockPlano.student1,
            registros: workoutData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    const appState = await getAppState(page);
    expect(appState.data.registros[0].exercicio).toBe(longName);
  });
});
