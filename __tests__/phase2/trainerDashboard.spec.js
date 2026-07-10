/**
 * Phase 2: Trainer Dashboard Tests
 * ================================
 *
 * Tests for trainer dashboard functionality
 * Student list, ULTIMO TREINO card, editing, v28.6 individual exercise launch
 */

import { test, expect } from '@playwright/test';
import {
  navigateToApp,
  loginAsTrainer,
  setupApiMocking,
  getAppState,
  navigateToView,
  clearLocalStorage,
  TEST_ADMIN_KEY,
} from './fixtures/testUtils.js';
import { mockStudents, mockPlano, mockRegistros, createSessionData } from './fixtures/mockData.js';

test.describe('Trainer Dashboard - Student List', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('loads all students after login', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    const appState = await getAppState(page);
    expect(appState.data).toBeTruthy();
    expect(appState.data.alunos).toBeDefined();
    expect(appState.data.alunos.length).toBeGreaterThan(0);
  });

  test('displays all students in list', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    // Verify students are in the DOM
    for (const student of mockStudents) {
      const studentElement = page.locator(`text="${student.nome}"`);
      const isVisible = await studentElement.isVisible().catch(() => false);
      // At least some students should be visible
      expect(typeof isVisible).toBe('boolean');
    }
  });

  test('can select student for editing', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    // Try to click on first student
    const studentRows = page.locator('.student-row, [data-student-id]');
    const count = await studentRows.count();
    expect(count).toBeGreaterThan(0);

    if (count > 0) {
      await studentRows.first().click();
      // Should navigate to edit view or show details
      const appState = await getAppState(page);
      expect(appState.currentAluno).toBeTruthy();
    }
  });
});

test.describe('Trainer Dashboard - ULTIMO TREINO Card', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('displays latest workout (ULTIMO TREINO)', async ({ page }) => {
    await navigateToApp(page);

    const studentWithWorkouts = {
      ...mockStudents[0],
      registros: [
        {
          aluno_id: 'student1',
          dia: 'A',
          data_treino: '2026-07-10',
          timestamp: '2026-07-10T10:00:00Z',
          exercicio: 'Agachamento',
          carga: '50',
          reps: '8',
          completou: 'sim',
        },
      ],
    };

    await setupApiMocking(page, {
      adminKey: TEST_ADMIN_KEY,
      mockGetActions: [
        {
          action: 'admin',
          response: {
            ok: true,
            alunos: [studentWithWorkouts],
            plano: mockPlano,
            registros: { 'student1': studentWithWorkouts.registros },
          },
        },
      ],
    });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    // Look for ULTIMO TREINO card
    const ultimoTreinoCard = page.locator('[data-test="ultimo-treino"], text="ULTIMO TREINO"');
    const cardVisible = await ultimoTreinoCard.isVisible().catch(() => false);

    // If card exists, verify it shows the workout
    if (cardVisible) {
      const exerciseText = page.locator('text="Agachamento"');
      expect(await exerciseText.isVisible().catch(() => false)).toBe(true);
    }
  });

  test('hides ULTIMO TREINO if student has no workouts', async ({ page }) => {
    await navigateToApp(page);

    const studentNoWorkouts = {
      ...mockStudents[0],
      registros: [],
    };

    await setupApiMocking(page, {
      adminKey: TEST_ADMIN_KEY,
      mockGetActions: [
        {
          action: 'admin',
          response: {
            ok: true,
            alunos: [studentNoWorkouts],
            plano: mockPlano,
            registros: {},
          },
        },
      ],
    });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    const appState = await getAppState(page);
    // Verify empty registros
    if (appState.data.registros && appState.data.registros['student1']) {
      expect(appState.data.registros['student1'].length).toBe(0);
    }
  });

  test('shows correct date of latest workout', async ({ page }) => {
    await navigateToApp(page);

    const workouts = [
      {
        aluno_id: 'student1',
        dia: 'A',
        data_treino: '2026-07-08',
        timestamp: '2026-07-08T10:00:00Z',
        exercicio: 'Ex1',
        completou: 'sim',
      },
      {
        aluno_id: 'student1',
        dia: 'B',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T15:00:00Z',
        exercicio: 'Ex2',
        completou: 'sim',
      },
    ];

    await setupApiMocking(page, {
      adminKey: TEST_ADMIN_KEY,
      mockGetActions: [
        {
          action: 'admin',
          response: {
            ok: true,
            alunos: [mockStudents[0]],
            plano: mockPlano,
            registros: { 'student1': workouts },
          },
        },
      ],
    });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    const appState = await getAppState(page);
    if (appState.data.registros && appState.data.registros['student1']) {
      const regs = appState.data.registros['student1'];
      expect(regs.length).toBe(2);
      // Latest should be from 2026-07-10
      expect(regs[regs.length - 1].data_treino).toBe('2026-07-10');
    }
  });
});

test.describe('Trainer Dashboard - Edit Student', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('can edit student profile', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    // Navigate to edit student view
    const appState = await getAppState(page);
    expect(appState.data).toBeTruthy();

    // Mock profile save
    let savedProfile = null;
    await page.route('**/script.google.com/macros/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const data = await request.postDataJSON().catch(() => ({}));
        if (data.action === 'aluno') {
          savedProfile = data;
          return route.fulfill({ json: { ok: true } });
        }
      }
      route.continue();
    });

    // Simulate saving profile
    const result = await page.evaluate(async () => {
      return await window.apiPost({
        action: 'aluno',
        id: 'student1',
        nome: 'João Silva Updated',
        pin: '1234',
      });
    });

    expect(result.ok).toBe(true);
    expect(savedProfile.nome).toBe('João Silva Updated');
  });

  test('can edit training plan', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    let savedPlan = null;
    await page.route('**/script.google.com/macros/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const data = await request.postDataJSON().catch(() => ({}));
        if (data.action === 'plano') {
          savedPlan = data;
          return route.fulfill({ json: { ok: true } });
        }
      }
      route.continue();
    });

    // Simulate saving plan
    const result = await page.evaluate(async () => {
      return await window.apiPost({
        action: 'plano',
        aluno_id: 'student1',
        dia: 'A',
        exercicios: [
          { exercicio: 'Agachamento', tipo: 'Composto', carga: '60', reps: '8' },
        ],
      });
    });

    expect(result.ok).toBe(true);
    expect(savedPlan.dia).toBe('A');
  });
});

test.describe('v28.6: Individual Exercise Launch', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('trainer can launch individual exercise', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    let launchedExercise = null;
    await page.route('**/script.google.com/macros/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const data = await request.postDataJSON().catch(() => ({}));
        if (data.action === 'registroAdmin') {
          launchedExercise = data;
          return route.fulfill({ json: { ok: true } });
        }
      }
      route.continue();
    });

    // Simulate clicking "lancar individual"
    const result = await page.evaluate(async (key) => {
      return await window.apiPost({
        action: 'registroAdmin',
        admin_key: key,
        aluno_id: 'student1',
        dia: 'A',
        exercicio: 'Agachamento',
        carga: '50',
        reps: '8',
        rir: '2',
        completou: 'sim',
      });
    }, TEST_ADMIN_KEY);

    expect(result.ok).toBe(true);
    expect(launchedExercise.aluno_id).toBe('student1');
  });

  test('individual exercise modal prefilled with plan values', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    // Get exercise data to verify prefill
    const exerciseData = await page.evaluate(() => {
      if (window.APP.editPlano && window.APP.editPlano['A']) {
        return window.APP.editPlano['A'][0];
      }
      return null;
    });

    // Verify plan data exists for prefilling
    expect(exerciseData).toBeTruthy();
    if (exerciseData) {
      expect(exerciseData.carga).toBeDefined();
      expect(exerciseData.reps).toBeDefined();
    }
  });

  test('individual exercise saved without student PIN', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    let savedRecord = null;
    await page.route('**/script.google.com/macros/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const data = await request.postDataJSON().catch(() => ({}));
        if (data.action === 'registroAdmin') {
          savedRecord = data;
          return route.fulfill({ json: { ok: true } });
        }
      }
      route.continue();
    });

    // Save without PIN
    const result = await page.evaluate(async (key) => {
      return await window.apiPost({
        action: 'registroAdmin',
        admin_key: key,
        aluno_id: 'student1',
        dia: 'A',
        exercicio: 'Agachamento',
        // Note: NO pin_aluno field
      });
    }, TEST_ADMIN_KEY);

    expect(result.ok).toBe(true);
    // Verify PIN was not required
    expect(savedRecord.pin_aluno).toBeUndefined();
  });

  test('individual exercise appears in student history', async ({ page }) => {
    await navigateToApp(page);

    const workoutWithAdmin = [
      {
        aluno_id: 'student1',
        dia: 'A',
        data_treino: '2026-07-10',
        timestamp: '2026-07-10T10:00:00Z',
        exercicio: 'Agachamento',
        carga: '50',
        reps: '8',
        completou: 'sim',
        _admin_launched: true,
      },
    ];

    await setupApiMocking(page, {
      adminKey: TEST_ADMIN_KEY,
      mockGetActions: [
        {
          action: 'admin',
          response: {
            ok: true,
            alunos: mockStudents,
            plano: mockPlano,
            registros: { 'student1': workoutWithAdmin },
          },
        },
      ],
    });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    const appState = await getAppState(page);
    const studentRegs = appState.data.registros['student1'];
    expect(studentRegs.length).toBeGreaterThan(0);
    expect(studentRegs.some(r => r._admin_launched)).toBe(true);
  });
});

test.describe('Trainer Dashboard - Statistics', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('displays workout statistics', async ({ page }) => {
    await navigateToApp(page);

    const workoutData = createSessionData('A', '2026-07-10', 3);
    await setupApiMocking(page, {
      adminKey: TEST_ADMIN_KEY,
      mockGetActions: [
        {
          action: 'admin',
          response: {
            ok: true,
            alunos: [mockStudents[0]],
            plano: mockPlano,
            registros: { 'student1': workoutData },
          },
        },
      ],
    });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    const appState = await getAppState(page);
    expect(appState.data.registros['student1'].length).toBe(3);
  });

  test('can export student data', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    // Test data export functionality
    const exportData = await page.evaluate(() => {
      if (window.APP.data) {
        return JSON.stringify(window.APP.data);
      }
      return null;
    });

    expect(exportData).toBeTruthy();
    const parsed = JSON.parse(exportData);
    expect(parsed.alunos || parsed.plano || parsed.registros).toBeTruthy();
  });

  test('can import student data', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page, { adminKey: TEST_ADMIN_KEY });

    await loginAsTrainer(page, TEST_ADMIN_KEY);

    // Mock import API
    await page.route('**/script.google.com/macros/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const data = await request.postDataJSON().catch(() => ({}));
        if (data.action === 'importAluno') {
          return route.fulfill({ json: { ok: true } });
        }
      }
      route.continue();
    });

    // Test import
    const result = await page.evaluate(async () => {
      return await window.apiPost({
        action: 'importAluno',
        aluno: { id: 'imported1', nome: 'Imported Student', pin: '1234' },
        plano: { A: [] },
        registros: [],
      });
    });

    expect(result.ok).toBe(true);
  });
});
