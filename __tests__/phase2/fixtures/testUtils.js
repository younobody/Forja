/**
 * Test utilities for Phase 2 frontend integration tests
 * Provides common setup, API mocking, and helper functions
 */

import { createAlunoResponse, createAdminResponse, TEST_ADMIN_KEY, TEST_CREDENTIALS } from './mockData.js';

// Re-export test credentials for convenience
export { TEST_ADMIN_KEY, TEST_CREDENTIALS };

/**
 * Setup API route interception for a test
 * Mocks all API calls to return fixture data
 * Supports requestDelay for simulating slow networks
 */
export async function setupApiMocking(page, options = {}) {
  const {
    mockGetActions = [],
    mockPostActions = [],
    adminKey = TEST_ADMIN_KEY,
    requestDelay = 0, // Optional delay in ms for slow network simulation
  } = options;

  // Intercept all fetch requests to the Apps Script endpoint
  await page.route('**/script.google.com/macros/**', async (route) => {
    // Apply network delay if specified
    if (requestDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, requestDelay));
    }

    const request = route.request();
    const postData = request.postDataJSON ? await request.postDataJSON().catch(() => ({})) : {};
    const queryParams = new URL(request.url()).searchParams;

    // GET requests
    if (request.method() === 'GET') {
      const action = queryParams.get('action');
      const alunoId = queryParams.get('aluno_id');
      const pin = queryParams.get('pin');
      const key = queryParams.get('key');

      // Student login (validarAluno)
      if (action === 'validarAluno') {
        if (alunoId === TEST_CREDENTIALS.id && pin === TEST_CREDENTIALS.pin) {
          return route.abort('blockedbyclient');
        }
      }

      // Get student data
      if (action === 'aluno') {
        const response = createAlunoResponse(alunoId);
        return route.fulfill({ json: response });
      }

      // Get admin data
      if (action === 'admin') {
        if (key !== adminKey) {
          return route.fulfill({ json: { error: 'Admin key inválida' } });
        }
        const response = createAdminResponse();
        return route.fulfill({ json: response });
      }

      // Custom GET handlers
      const customHandler = mockGetActions.find(h => h.action === action);
      if (customHandler) {
        return route.fulfill({ json: customHandler.response });
      }
    }

    // POST requests
    if (request.method() === 'POST') {
      const action = postData.action;

      // Save registro (standard workout save)
      if (action === 'registro' || action === 'salvarRegistro') {
        return route.fulfill({ json: { ok: true, timestamp: new Date().toISOString() } });
      }

      // Save plano
      if (action === 'plano') {
        return route.fulfill({ json: { ok: true } });
      }

      // Save student
      if (action === 'aluno') {
        return route.fulfill({ json: { ok: true } });
      }

      // Admin register workout (v28.6)
      if (action === 'registroAdmin') {
        if (postData.admin_key !== adminKey) {
          return route.fulfill({ json: { error: 'Admin key inválida' } });
        }
        return route.fulfill({ json: { ok: true, registrado_em: new Date().toISOString() } });
      }

      // Import/export actions
      if (action === 'importAluno') {
        return route.fulfill({ json: { ok: true } });
      }

      // Custom POST handlers
      const customHandler = mockPostActions.find(h => h.action === action);
      if (customHandler) {
        return route.fulfill({ json: customHandler.response });
      }
    }

    // Fallback: continue with original request
    route.continue();
  });
}

/**
 * Navigate to the app and set configuration
 */
export async function navigateToApp(page, appsUrl = 'https://script.google.com/macros/s/test/exec') {
  // Load the HTML file
  const htmlPath = new URL('../../../forja.html', import.meta.url).pathname;
  await page.goto(`file://${htmlPath}`);

  // Wait for app to initialize
  await page.waitForFunction(() => {
    return typeof window.APP !== 'undefined';
  });

  // Set the Apps Script URL in localStorage
  await page.evaluate((url) => {
    localStorage.setItem('appsScriptUrl', url);
    if (window.APP) {
      window.APP.appsScriptUrl = url;
    }
  }, appsUrl);
}

/**
 * Login as student
 */
export async function loginAsStudent(page, id = TEST_CREDENTIALS.id, pin = TEST_CREDENTIALS.pin) {
  // Navigate to home view
  await page.evaluate(() => {
    window.navigateTo('#view-home');
  });

  // Wait for login form
  await page.waitForSelector('#home-id', { timeout: 5000 });

  // Fill credentials
  await page.fill('#home-id', id);
  await page.fill('#home-pin', pin);

  // Mock the API response for validation
  await page.route('**/script.google.com/macros/**', async (route) => {
    const request = route.request();
    const params = new URL(request.url()).searchParams;

    if (params.get('action') === 'validarAluno' && params.get('aluno_id') === id && params.get('pin') === pin) {
      // Valid login
      return route.fulfill({
        json: {
          ok: true,
          aluno: { id, nome: 'Test Student' },
          plano: { A: [], B: [], C: [], D: [], E: [] },
          registros: [],
        },
      });
    }

    route.continue();
  });

  // Click login
  await page.click('#btn-home-entrar');

  // Wait for workout view to appear
  await page.waitForSelector('#view-aluno:not(.hidden)', { timeout: 10000 });
}

/**
 * Login as trainer
 */
export async function loginAsTrainer(page, key = TEST_ADMIN_KEY) {
  // Navigate to trainer login
  await page.evaluate(() => {
    window.navigateTo('#view-trainer-login');
  });

  // Wait for login form
  await page.waitForSelector('#trainer-key', { timeout: 5000 });

  // Fill key
  await page.fill('#trainer-key', key);

  // Mock the API response
  await page.route('**/script.google.com/macros/**', async (route) => {
    const request = route.request();
    const params = new URL(request.url()).searchParams;

    if (params.get('action') === 'admin' && params.get('key') === key) {
      // Valid login
      return route.fulfill({
        json: {
          ok: true,
          alunos: [
            { id: 'student1', nome: 'Test Student 1' },
            { id: 'student2', nome: 'Test Student 2' },
          ],
          plano: {},
          registros: {},
        },
      });
    }

    route.continue();
  });

  // Click login
  await page.click('#btn-trainer-entrar');

  // Wait for trainer dashboard
  await page.waitForSelector('#view-trainer:not(.hidden)', { timeout: 10000 });
}

/**
 * Get all toasts currently displayed
 */
export async function getAllToasts(page) {
  return await page.locator('.toast').all();
}

/**
 * Wait for a toast with specific text
 */
export async function waitForToast(page, text, type = 'info') {
  const selector = `.toast.${type}:has-text("${text}")`;
  await page.waitForSelector(selector, { timeout: 5000 });
}

/**
 * Check if view is visible
 */
export async function isViewVisible(page, viewId) {
  const view = page.locator(`#${viewId}`);
  const classList = await view.getAttribute('class');
  return !classList.includes('hidden');
}

/**
 * Navigate to view and wait for it to be visible
 */
export async function navigateToView(page, viewId) {
  await page.evaluate((id) => {
    window.navigateTo(`#${id}`);
  }, viewId);

  await page.waitForFunction((id) => {
    const view = document.getElementById(id);
    return view && !view.classList.contains('hidden');
  }, viewId, { timeout: 5000 });
}

/**
 * Create a new workout record programmatically
 */
export async function createWorkoutRecord(page, dia, exercicio, data = null) {
  const today = data || new Date().toISOString().split('T')[0];

  await page.evaluate(
    ({ dia, exercicio, data }) => {
      if (window.APP && window.APP.data) {
        window.APP.data.registros = window.APP.data.registros || [];
        window.APP.data.registros.push({
          aluno_id: window.APP.alunoSession?.id || 'test',
          dia,
          data_treino: data,
          timestamp: new Date().toISOString(),
          exercicio,
          carga: '50',
          reps: '8',
          rir: '2',
          completou: 'sim',
          obs: '',
        });
      }
    },
    { dia, exercicio, data: today },
  );
}

/**
 * Get current APP state
 */
export async function getAppState(page) {
  return await page.evaluate(() => {
    return window.APP;
  });
}

/**
 * Set localStorage value
 */
export async function setLocalStorage(page, key, value) {
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }, { key, value });
}

/**
 * Get localStorage value
 */
export async function getLocalStorage(page, key) {
  return await page.evaluate((key) => {
    return localStorage.getItem(key);
  }, key);
}

/**
 * Clear all localStorage
 */
export async function clearLocalStorage(page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * Get error message from page (if any)
 */
export async function getErrorMessage(page) {
  const toasts = await page.locator('.toast.error').all();
  if (toasts.length === 0) return null;
  return await toasts[toasts.length - 1].textContent();
}

/**
 * Wait for loading spinner to appear and disappear
 */
export async function waitForLoadingComplete(page) {
  const loader = page.locator('#loading-overlay');
  await loader.waitFor({ state: 'hidden', timeout: 10000 });
}
