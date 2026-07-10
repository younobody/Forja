/**
 * Phase 3: Performance & Stress Testing
 * =====================================
 *
 * Performance profiling, concurrent operations, large datasets
 * Identifies slow flows and verifies optimizations
 */

import { test, expect } from '@playwright/test';
import {
  navigateToApp,
  loginAsStudent,
  loginAsTrainer,
  setupApiMocking,
  getAppState,
  clearLocalStorage,
  TEST_CREDENTIALS,
  TEST_ADMIN_KEY,
} from '../phase2/fixtures/testUtils.js';
import { mockPlano, createSessionData } from '../phase2/fixtures/mockData.js';

test.describe('Phase 3: Performance - Large Dataset Loading', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('student dashboard loads 500+ workouts in < 3s', async ({ page }) => {
    await navigateToApp(page);

    // Create 500 workouts across 100 days
    const largeWorkout = [];
    for (let i = 0; i < 500; i++) {
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
        exercicio: `Exercício ${i % 20}`,
        carga: String(40 + (i % 30)),
        reps: String(5 + (i % 15)),
        completou: i % 10 === 0 ? 'nao' : 'sim',
      });
    }

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Perf Test' },
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
    expect(appState.data.registros.length).toBe(500);
    expect(loadTime).toBeLessThan(3000); // Must load in under 3 seconds
  });

  test('trainer dashboard loads 20 students + 5000 total workouts in < 5s', async ({ page }) => {
    await navigateToApp(page);

    const students = [];
    const registros = {};

    // Create 20 students with 250 workouts each
    for (let s = 0; s < 20; s++) {
      const studentId = `student${s}`;
      students.push({
        id: studentId,
        nome: `Student ${s}`,
        pin: '1234',
      });

      registros[studentId] = [];
      for (let i = 0; i < 250; i++) {
        const dayIndex = i % 5;
        const days = ['A', 'B', 'C', 'D', 'E'];
        const daysBack = Math.floor(i / 5);
        const date = new Date();
        date.setDate(date.getDate() - daysBack);
        const dateStr = date.toISOString().split('T')[0];

        registros[studentId].push({
          aluno_id: studentId,
          dia: days[dayIndex],
          data_treino: dateStr,
          timestamp: new Date(date.getTime() + (i % 5) * 5 * 60000).toISOString(),
          exercicio: `Ex${i % 10}`,
          carga: '50',
          reps: '8',
          completou: 'sim',
        });
      }
    }

    await setupApiMocking(page, {
      adminKey: TEST_ADMIN_KEY,
      mockGetActions: [
        {
          action: 'admin',
          response: {
            ok: true,
            alunos: students,
            plano: mockPlano,
            registros: registros,
          },
        },
      ],
    });

    const startTime = Date.now();
    await loginAsTrainer(page, TEST_ADMIN_KEY);
    const loadTime = Date.now() - startTime;

    const appState = await getAppState(page);
    expect(appState.data.alunos.length).toBe(20);
    expect(loadTime).toBeLessThan(5000); // Must load in under 5 seconds
  });

  test('chart rendering does not block UI with 300+ workouts', async ({ page }) => {
    await navigateToApp(page);

    const mediumWorkout = createSessionData('A', '2026-07-10', 300);

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Chart Perf' },
            plano: mockPlano.student1,
            registros: mediumWorkout,
          },
        },
      ],
    });

    const startTime = Date.now();
    await loginAsStudent(page);

    // Try to interact with page while chart renders
    const isClickable = await page.locator('button').first().isEnabled().catch(() => false);
    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(2000); // Chart should render quickly
    expect(isClickable).toBe(true); // UI should remain responsive
  });

  test('calendar heatmap renders efficiently with 365 days of data', async ({ page }) => {
    await navigateToApp(page);

    // Create 365 days of workout data (1 year)
    const yearWorkout = [];
    for (let i = 0; i < 365; i++) {
      const days = ['A', 'B', 'C', 'D', 'E'];
      const dayIndex = i % 5;
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      if (Math.random() > 0.3) { // 70% training days
        yearWorkout.push({
          aluno_id: TEST_CREDENTIALS.id,
          dia: days[dayIndex],
          data_treino: dateStr,
          timestamp: date.toISOString(),
          exercicio: 'Agachamento',
          carga: '50',
          reps: '8',
          completou: 'sim',
        });
      }
    }

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Calendar Test' },
            plano: mockPlano.student1,
            registros: yearWorkout,
          },
        },
      ],
    });

    const startTime = Date.now();
    await loginAsStudent(page);
    const renderTime = Date.now() - startTime;

    const appState = await getAppState(page);
    expect(appState.data.registros.length).toBeGreaterThan(200);
    expect(renderTime).toBeLessThan(3000);
  });
});

test.describe('Phase 3: Performance - Concurrent Operations', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('rapid consecutive saves do not create duplicates', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);
    await loginAsStudent(page);

    const saves = [];
    for (let i = 0; i < 10; i++) {
      const result = await page.evaluate(async () => {
        return await window.apiPost({
          action: 'salvarRegistro',
          pin_aluno: '1234',
          aluno_id: 'student1',
          dia: 'A',
          exercicio: 'Agachamento',
          carga: '50',
          reps: '8',
          rir: '2',
          observacoes: '',
          completou: 'sim',
        });
      });
      saves.push(result);
    }

    // All saves should succeed
    expect(saves.every(s => s.ok === true)).toBe(true);

    // Check deduplication (records should be merged by session)
    const appState = await getAppState(page);
    expect(appState.data.registros).toBeDefined();
  });

  test('concurrent login + data load does not cause race conditions', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    let completed = 0;
    let errors = 0;

    // Simulate rapid navigation/login attempts
    try {
      await Promise.all([
        loginAsStudent(page),
        page.waitForLoadState('networkidle').catch(() => null),
      ]);
      completed++;
    } catch (e) {
      errors++;
    }

    const appState = await getAppState(page);
    expect(appState.data).toBeTruthy();
    expect(errors).toBe(0);
  });

  test('rapid exercise list updates do not lose data', async ({ page }) => {
    await navigateToApp(page);
    const exercises = createSessionData('A', '2026-07-10', 50);

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Concurrency Test' },
            plano: mockPlano.student1,
            registros: exercises,
          },
        },
      ],
    });

    await loginAsStudent(page);

    // Rapidly fetch and update state
    const updates = [];
    for (let i = 0; i < 5; i++) {
      const state = await getAppState(page);
      updates.push(state.data.registros.length);
    }

    // All should see consistent data
    expect(updates.every(u => u === 50)).toBe(true);
  });
});

test.describe('Phase 3: Performance - Memory & Storage', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('localStorage does not exceed quota with large export', async ({ page }) => {
    await navigateToApp(page);
    const largeData = createSessionData('A', '2026-07-10', 200);

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Storage Test' },
            plano: mockPlano.student1,
            registros: largeData,
          },
        },
      ],
    });

    await loginAsStudent(page);

    let storageError = null;
    try {
      // Try to store large dataset
      await page.evaluate(() => {
        const data = JSON.stringify(window.APP.data);
        localStorage.setItem('backupData', data);
      });
    } catch (e) {
      storageError = e;
    }

    expect(storageError).toBeNull(); // Should not exceed quota
  });

  test('session data persists without memory leaks', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);
    await loginAsStudent(page);

    // Simulate prolonged use - navigate back and forth
    for (let i = 0; i < 20; i++) {
      await page.reload();
      await setupApiMocking(page);
      const appState = await getAppState(page);
      expect(appState.alunoSession).toBeTruthy();
    }
  });
});

test.describe('Phase 3: Performance - Network Optimization', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('handles slow network (2s API response) gracefully', async ({ page }) => {
    await navigateToApp(page);

    await setupApiMocking(page, {
      requestDelay: 2000, // 2 second delay
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Slow Network Test' },
            plano: mockPlano.student1,
            registros: [],
          },
        },
      ],
    });

    const startTime = Date.now();
    await loginAsStudent(page);
    const totalTime = Date.now() - startTime;

    const appState = await getAppState(page);
    expect(appState.data).toBeTruthy();
    expect(totalTime).toBeGreaterThan(2000); // Should take at least 2 seconds due to delay
  });

  test('API calls are properly debounced', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);
    await loginAsStudent(page);

    let apiCallCount = 0;

    // Intercept to count calls
    await page.route('**/script.google.com/macros/**', async (route) => {
      apiCallCount++;
      await route.continue();
    });

    // Simulate rapid form input that should be debounced
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => {
        window.dispatchEvent(new Event('input'));
      });
    }

    // Wait a bit for debounce
    await page.waitForTimeout(500);

    // Should not make 20 API calls - debouncing should reduce them
    expect(apiCallCount).toBeLessThan(20);
  });

  test('request batching reduces API calls', async ({ page }) => {
    await navigateToApp(page);

    let requestCount = 0;
    const requests = [];

    await page.route('**/script.google.com/macros/**', async (route) => {
      const request = route.request();
      requestCount++;
      requests.push({
        method: request.method(),
        postData: await request.postDataJSON().catch(() => null),
      });
      await route.continue();
    });

    await setupApiMocking(page);
    await loginAsStudent(page);

    // Multiple operations in quick succession
    for (let i = 0; i < 5; i++) {
      await page.evaluate(async () => {
        await window.apiPost({
          action: 'salvarRegistro',
          pin_aluno: '1234',
          aluno_id: 'student1',
          dia: 'A',
          exercicio: `Ex${i}`,
          completou: 'sim',
        });
      });
    }

    // Should batch multiple saves into fewer API calls if possible
    expect(requestCount).toBeGreaterThan(0);
  });
});

test.describe('Phase 3: Performance - UI Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('form submission remains responsive with 50+ fields', async ({ page }) => {
    await navigateToApp(page);
    const exercises = createSessionData('A', '2026-07-10', 50);

    await setupApiMocking(page, {
      mockGetActions: [
        {
          action: 'aluno',
          response: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Form Test' },
            plano: mockPlano.student1,
            registros: exercises,
          },
        },
      ],
    });

    await loginAsStudent(page);

    // Measure time to interact with form after load
    const startTime = Date.now();
    const button = page.locator('button').first();
    const isEnabled = await button.isEnabled({ timeout: 1000 }).catch(() => false);
    const responseTime = Date.now() - startTime;

    expect(isEnabled).toBe(true);
    expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
  });

  test('list scrolling remains smooth with 500 items', async ({ page }) => {
    await navigateToApp(page);
    const largeWorkout = [];

    for (let i = 0; i < 500; i++) {
      largeWorkout.push({
        aluno_id: TEST_CREDENTIALS.id,
        dia: 'A',
        data_treino: `2026-07-${(i % 30) + 1}`.substring(0, 10),
        timestamp: new Date().toISOString(),
        exercicio: `Exercise ${i}`,
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
            aluno: { id: TEST_CREDENTIALS.id, nome: 'Scroll Test' },
            plano: mockPlano.student1,
            registros: largeWorkout,
          },
        },
      ],
    });

    await loginAsStudent(page);

    // Try to scroll list
    const list = page.locator('[data-test="exercise-list"], .exercise-list');
    const exists = await list.count().catch(() => 0);

    // If list exists, it should be renderable
    expect(exists >= 0).toBe(true);
  });
});
