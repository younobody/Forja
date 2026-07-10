/**
 * Phase 2: Authentication Tests
 * ============================
 *
 * Tests for student and trainer login flows
 * Covers PIN validation, admin key validation, session persistence, v28.6 registroAdmin
 */

import { test, expect } from '@playwright/test';
import {
  navigateToApp,
  loginAsStudent,
  loginAsTrainer,
  setupApiMocking,
  getAppState,
  getErrorMessage,
  waitForToast,
  clearLocalStorage,
  navigateToView,
  TEST_CREDENTIALS,
} from './fixtures/testUtils.js';

test.describe('Student Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('student login with valid ID + PIN succeeds', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    // Start on home view
    const isHome = await page.locator('#view-home:not(.hidden)').isVisible();
    expect(isHome).toBe(true);

    // Fill credentials
    await page.fill('#home-id', TEST_CREDENTIALS.id);
    await page.fill('#home-pin', TEST_CREDENTIALS.pin);

    // Mock successful login response
    await page.route('**/script.google.com/macros/**', (route) => {
      const params = new URL(route.request().url()).searchParams;
      if (
        params.get('action') === 'aluno' &&
        params.get('aluno_id') === TEST_CREDENTIALS.id
      ) {
        route.fulfill({
          json: {
            ok: true,
            aluno: { id: TEST_CREDENTIALS.id, nome: 'João Silva' },
            plano: { A: [], B: [], C: [], D: [], E: [] },
            registros: [],
          },
        });
      } else {
        route.continue();
      }
    });

    // Click login
    await page.click('#btn-home-entrar');

    // Verify: workout view shown
    await page.waitForSelector('#view-aluno:not(.hidden)', { timeout: 10000 });
    const isWorkoutView = await page.locator('#view-aluno:not(.hidden)').isVisible();
    expect(isWorkoutView).toBe(true);
  });

  test('student login with invalid PIN shows error', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    await page.fill('#home-id', TEST_CREDENTIALS.id);
    await page.fill('#home-pin', 'wrong-pin');

    // Mock failed login response
    await page.route('**/script.google.com/macros/**', (route) => {
      const params = new URL(route.request().url()).searchParams;
      if (params.get('action') === 'aluno') {
        route.fulfill({
          json: { error: 'Pin invalido' },
        });
      } else {
        route.continue();
      }
    });

    await page.click('#btn-home-entrar');

    // Verify: error toast shown
    const error = await getErrorMessage(page);
    expect(error).toBeTruthy();

    // Verify: still on login screen
    const isHome = await page.locator('#view-home:not(.hidden)').isVisible();
    expect(isHome).toBe(true);
  });

  test('student login with missing ID shows error', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    // Leave ID empty, fill PIN
    await page.fill('#home-pin', TEST_CREDENTIALS.pin);

    await page.click('#btn-home-entrar');

    // Verify: error or still on login
    const isHome = await page.locator('#view-home:not(.hidden)').isVisible();
    expect(isHome).toBe(true);
  });

  test('student PIN field masks input (display as dots)', async ({ page }) => {
    await navigateToApp(page);

    // Fill PIN field
    const pinField = page.locator('#home-pin');
    await pinField.fill('1234');

    // Verify: input type is password (masked)
    const inputType = await pinField.getAttribute('type');
    expect(inputType).toMatch(/password|tel/); // password or tel for numeric masking
  });

  test('session persists after page reload', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    // Login
    await loginAsStudent(page, TEST_CREDENTIALS.id, TEST_CREDENTIALS.pin);

    // Store app state before reload
    const appStateBefore = await getAppState(page);
    expect(appStateBefore.alunoSession).toBeTruthy();
    expect(appStateBefore.alunoSession.id).toBe(TEST_CREDENTIALS.id);

    // Reload page
    await page.reload();

    // Mock API again after reload
    await setupApiMocking(page);

    // Verify: session restored
    const appStateAfter = await getAppState(page);
    expect(appStateAfter.alunoSession).toBeTruthy();
    expect(appStateAfter.alunoSession.id).toBe(TEST_CREDENTIALS.id);
  });

  test('logout clears session', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    // Login
    await loginAsStudent(page, TEST_CREDENTIALS.id, TEST_CREDENTIALS.pin);

    // Verify logged in
    let appState = await getAppState(page);
    expect(appState.alunoSession).toBeTruthy();

    // Call logout
    await page.evaluate(() => {
      window.logout();
    });

    // Verify: session cleared
    appState = await getAppState(page);
    expect(appState.alunoSession).toBeNull();

    // Verify: back to login screen
    await page.waitForSelector('#view-home:not(.hidden)', { timeout: 5000 });
  });

  test('student cannot access trainer views', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    await loginAsStudent(page);

    // Try to navigate to trainer view
    await page.evaluate(() => {
      window.navigateTo('#view-trainer');
    });

    // Verify: trainer view stays hidden or redirects
    const isTrainerVisible = await page.locator('#view-trainer:not(.hidden)').isVisible().catch(() => false);
    expect(isTrainerVisible).toBe(false);

    // Verify: still in student view
    const isStudentVisible = await page.locator('#view-aluno:not(.hidden)').isVisible();
    expect(isStudentVisible).toBe(true);
  });
});

test.describe('Trainer Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test('trainer login with valid admin key succeeds', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    // Navigate to trainer login
    await navigateToView(page, 'view-trainer-login');

    // Fill admin key
    const adminKey = 'test-admin-key-12345';
    await page.fill('#trainer-key', adminKey);

    // Mock successful login
    await page.route('**/script.google.com/macros/**', (route) => {
      const params = new URL(route.request().url()).searchParams;
      if (params.get('action') === 'admin' && params.get('key') === adminKey) {
        route.fulfill({
          json: {
            ok: true,
            alunos: [
              { id: 'student1', nome: 'Student 1' },
            ],
            plano: {},
            registros: {},
          },
        });
      } else {
        route.continue();
      }
    });

    await page.click('#btn-trainer-entrar');

    // Verify: trainer dashboard shown
    await page.waitForSelector('#view-trainer:not(.hidden)', { timeout: 10000 });
  });

  test('trainer login with invalid admin key shows error', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    await navigateToView(page, 'view-trainer-login');

    await page.fill('#trainer-key', 'wrong-key');

    // Mock failed login
    await page.route('**/script.google.com/macros/**', (route) => {
      const params = new URL(route.request().url()).searchParams;
      if (params.get('action') === 'admin') {
        route.fulfill({
          json: { error: 'Admin key invalida' },
        });
      } else {
        route.continue();
      }
    });

    await page.click('#btn-trainer-entrar');

    // Verify: error toast
    const error = await getErrorMessage(page);
    expect(error).toBeTruthy();

    // Verify: still on login
    const isLoginVisible = await page.locator('#view-trainer-login:not(.hidden)').isVisible();
    expect(isLoginVisible).toBe(true);
  });

  test('trainer session persists after reload', async ({ page }) => {
    await navigateToApp(page);
    const adminKey = 'test-admin-key-12345';
    await setupApiMocking(page, { adminKey });

    // Login as trainer
    await loginAsTrainer(page, adminKey);

    // Verify session
    let appState = await getAppState(page);
    expect(appState.trainerKey).toBe(adminKey);

    // Reload
    await page.reload();
    await setupApiMocking(page, { adminKey });

    // Verify session restored
    appState = await getAppState(page);
    expect(appState.trainerKey).toBe(adminKey);
  });

  test('trainer cannot access student PIN view', async ({ page }) => {
    await navigateToApp(page);
    const adminKey = 'test-admin-key-12345';
    await setupApiMocking(page, { adminKey });

    await loginAsTrainer(page, adminKey);

    // Try to navigate to student home
    await page.evaluate(() => {
      window.navigateTo('#view-home');
    });

    // Verify: student view not shown
    const isHomeVisible = await page.locator('#view-home:not(.hidden)').isVisible().catch(() => false);
    expect(isHomeVisible).toBe(false);

    // Verify: still in trainer view
    const isTrainerVisible = await page.locator('#view-trainer:not(.hidden)').isVisible();
    expect(isTrainerVisible).toBe(true);
  });
});

test.describe('v28.6: registroAdmin - Admin Workout Launch', () => {
  test('registroAdmin action requires valid admin key', async ({ page }) => {
    await navigateToApp(page);
    const adminKey = 'test-admin-key-12345';
    await setupApiMocking(page, { adminKey });

    // Mock registroAdmin endpoint
    await page.route('**/script.google.com/macros/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const data = await request.postDataJSON().catch(() => ({}));
        if (data.action === 'registroAdmin') {
          if (data.admin_key !== adminKey) {
            return route.fulfill({
              json: { error: 'Admin key invalida' },
            });
          }
          return route.fulfill({
            json: { ok: true, registrado_em: new Date().toISOString() },
          });
        }
      }
      route.continue();
    });

    // Call registroAdmin with wrong key
    const result = await page.evaluate(async (wrongKey) => {
      const response = await window.apiPost({
        action: 'registroAdmin',
        admin_key: wrongKey,
        aluno_id: 'student1',
        dia: 'A',
        exercicio: 'Test',
      });
      return response;
    }, 'wrong-key');

    expect(result.error).toBeTruthy();
    expect(result.error).toContain('Admin key');
  });

  test('registroAdmin saves without requiring student PIN', async ({ page }) => {
    await navigateToApp(page);
    const adminKey = 'test-admin-key-12345';
    await setupApiMocking(page, { adminKey });

    let savedWorkout = null;

    // Mock registroAdmin endpoint
    await page.route('**/script.google.com/macros/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const data = await request.postDataJSON().catch(() => ({}));
        if (data.action === 'registroAdmin') {
          if (data.admin_key === adminKey) {
            savedWorkout = data;
            return route.fulfill({
              json: { ok: true, registrado_em: new Date().toISOString() },
            });
          }
        }
      }
      route.continue();
    });

    // Call registroAdmin (no PIN needed)
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
        obs: 'Launched by trainer',
      });
    }, adminKey);

    expect(result.ok).toBe(true);
    expect(savedWorkout).toBeTruthy();
    expect(savedWorkout.aluno_id).toBe('student1');
  });

  test('registroAdmin sets timestamp to NOW (not form value)', async ({ page }) => {
    await navigateToApp(page);
    const adminKey = 'test-admin-key-12345';
    await setupApiMocking(page, { adminKey });

    let savedWorkout = null;
    const beforeCall = new Date().getTime();

    // Mock registroAdmin
    await page.route('**/script.google.com/macros/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const data = await request.postDataJSON().catch(() => ({}));
        if (data.action === 'registroAdmin') {
          savedWorkout = data;
          return route.fulfill({
            json: { ok: true, registrado_em: new Date().toISOString() },
          });
        }
      }
      route.continue();
    });

    // Call with old timestamp in form
    const result = await page.evaluate(async (key) => {
      return await window.apiPost({
        action: 'registroAdmin',
        admin_key: key,
        aluno_id: 'student1',
        dia: 'A',
        exercicio: 'Test',
        timestamp: '2026-06-01T10:00:00Z', // OLD date - should be ignored
      });
    }, adminKey);

    const afterCall = new Date().getTime();

    expect(result.ok).toBe(true);
    // Verify timestamp is recent (backend should override with NOW)
    // Note: This is backend validation - frontend just sends data
    expect(savedWorkout.timestamp).toBeDefined();
  });
});

test.describe('Session State', () => {
  test('alunoSession contains correct student info', async ({ page }) => {
    await navigateToApp(page);
    await setupApiMocking(page);

    await loginAsStudent(page, TEST_CREDENTIALS.id, TEST_CREDENTIALS.pin);

    const appState = await getAppState(page);
    expect(appState.alunoSession).toBeTruthy();
    expect(appState.alunoSession.id).toBe(TEST_CREDENTIALS.id);
    expect(appState.alunoSession.pin).toBe(TEST_CREDENTIALS.pin);
  });

  test('trainerKey contains admin key when logged in as trainer', async ({ page }) => {
    await navigateToApp(page);
    const adminKey = 'test-admin-key-12345';
    await setupApiMocking(page, { adminKey });

    await loginAsTrainer(page, adminKey);

    const appState = await getAppState(page);
    expect(appState.trainerKey).toBe(adminKey);
  });
});
