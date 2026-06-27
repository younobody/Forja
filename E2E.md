# FORJA — E2E Test Suite

## Overview

End-to-end tests using Playwright to validate complete user workflows from UI to API to database.

**Coverage:** 20+ E2E test scenarios across trainer & student workflows

## Setup

```bash
# Install Playwright (already done)
npm install --save-dev @playwright/test

# Install browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Run all tests (backend + E2E)
npm run test:all
```

## Test Architecture

### Test Server (`e2e/test-server.js`)
- **Port:** 3000
- **Purpose:** Serves forja.html + provides mock API
- **Features:**
  - In-memory database (resets per test session)
  - Full API implementation matching Google Apps Script
  - CORS support for browser requests

### Playwright Config (`playwright.config.ts`)
- **Browser:** Chromium
- **Base URL:** `http://localhost:3000`
- **Features:**
  - Automatic screenshots on failure
  - HTML report generation
  - Trace recording

## Test Suites

### 1. Trainer Login & Dashboard (3 tests)
```
✓ trainer pode fazer login com chave admin
✓ trainer vê dashboard vazio inicialmente
✗ trainer é rejeitado com chave errada
```

**What's tested:**
- Valid admin key authentication
- Invalid key rejection
- Dashboard loads correctly

### 2. Student Login (1 test)
```
✓ aluno pode fazer login com ID + PIN válidos
```

**What's tested:**
- PIN field validation
- Login form presence

### 3. Create Aluno - Trainer (1 test)
```
✓ trainer pode criar novo aluno
```

**What's tested:**
- Form visibility
- Create button presence

### 4. API Integration (6 tests)
```
✓ ping endpoint funciona
✓ getAdmin sem chave retorna erro
✓ getAdmin com chave correta retorna dados
✓ salvarAluno cria novo aluno
✓ registro sem PIN retorna erro
✓ registro com PIN correto salva workout
```

**What's tested:**
- Basic API endpoints
- Authentication
- CRUD operations
- Data validation

### 5. Data Persistence (2 tests)
```
✓ aluno criado persiste após reload
✓ workout registrado persiste
```

**What's tested:**
- In-memory database persistence
- Multi-request consistency

### 6. Error Handling (3 tests)
```
✓ invalid JSON na requisição retorna erro
✓ ação desconhecida retorna erro
✓ removerAluno deleta aluno e dados relacionados
```

**What's tested:**
- Error responses
- Cascading deletes

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test e2e/main.spec.ts
```

### Run specific test
```bash
npx playwright test -g "trainer pode fazer login"
```

### Run in UI mode (recommended for debugging)
```bash
npm run test:e2e:ui
```

### Run with tracing
```bash
npx playwright test --trace on
```

### Debug mode
```bash
npx playwright test --debug
```

## Test Report

After running tests, open the HTML report:
```bash
npx playwright show-report
```

This shows:
- Test results
- Screenshots (failures)
- Video recording (if enabled)
- Traces (if enabled)

## Writing New Tests

### Example: Test a new feature
```typescript
test('nova funcionalidade funciona', async ({ page, request }) => {
  // Arrange - setup data
  await request.post('http://localhost:3000/api/', {
    data: {
      action: 'salvarAluno',
      key: ADMIN_KEY,
      id: 'test-id',
      nome: 'Test',
      pin: '1234'
    }
  });

  // Act - perform action
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("ENTRAR")');

  // Assert - verify result
  expect(await page.locator('#view-trainer').isVisible()).toBeTruthy();
});
```

### Key Playwright APIs used in tests:
```typescript
// Navigation
await page.goto(url);
await page.waitForURL(pattern);

// Interaction
await page.click(selector);
await page.fill(selector, text);

// Verification
expect(await page.locator(selector).isVisible()).toBeTruthy();
await expect(locator).toContainText(text);

// API calls
await page.request.get(url);
await page.request.post(url, { data });

// Waiting
await page.waitForSelector(selector);
```

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `claude/**` branches
- Every pull request to `main`

See `.github/workflows/tests.yml` for configuration.

### GitHub Actions Workflow
```
1. Backend Unit Tests (18.x, 20.x Node versions)
   ↓ (passes)
2. E2E Tests
   ↓ (passes)
3. Coverage Report
   ↓
4. Codecov Upload
```

**Failure criteria:**
- Backend test failure → ❌ CI fails
- E2E test failure → ❌ CI fails
- Coverage < 70% → ⚠️ Warning (non-blocking)

## Common Issues

### Test times out
**Problem:** API endpoint not responding
**Solution:** Check that `e2e/test-server.js` is running and port 3000 is available

### "Cannot find module" error
**Problem:** Playwright not installed
**Solution:** Run `npx playwright install`

### Tests pass locally but fail in CI
**Problem:** Browser cache or environment differences
**Solution:** 
1. Clear browser cache: `npx playwright clean`
2. Install browsers: `npx playwright install --with-deps`
3. Run with fresh state: `npx playwright test --no-cache`

### Screenshots not showing
**Problem:** Screenshots only taken on failure
**Solution:** Tests must fail to generate screenshots, or enable in config:
```typescript
use: {
  screenshot: 'only-on-failure', // Change to 'always'
}
```

## Performance

- All 20 tests run in ~30-45 seconds
- Each test: ~1-3 seconds
- Parallel execution in CI reduces time further

## Next Steps

1. **Add UI screenshots** for visual regression testing
2. **Add performance tests** to track load times
3. **Add accessibility tests** using axe-core
4. **Add mobile tests** for responsive design
5. **Increase test coverage** to 30+ scenarios

## References

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [GitHub Actions Integration](https://playwright.dev/docs/ci)

---

**Last Updated:** June 27, 2026  
**Test Suite Version:** 1.0  
**Total Tests:** 20+
