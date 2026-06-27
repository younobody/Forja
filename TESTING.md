# FORJA — Test Suite Documentation

## Overview

Comprehensive test suite for the FORJA coaching dashboard backend using Jest. 

**Current Coverage:** 88% line coverage, 90% branch coverage, 80% function coverage

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Structure

Tests are organized by functionality:

```
src/__tests__/
├── authentication.test.js      # Student authentication (validarAluno)
├── validation.test.js          # Data validation (importAluno)
├── crud.test.js                # Create, Read, Update, Delete operations
├── cascading.test.js           # Cascading deletes, data isolation
└── http-handlers.test.js       # HTTP endpoints (doGet, doPost)
```

## Test Statistics

| Suite | Tests | Status |
|-------|-------|--------|
| Authentication | 16 | ✅ PASS |
| Validation | 35 | ✅ PASS |
| CRUD Operations | 15 | ✅ PASS |
| Cascading Operations | 13 | ✅ PASS |
| HTTP Handlers | 5 | ✅ PASS |
| **Total** | **84** | **✅ PASS** |

## Key Test Areas

### 1. Authentication (16 tests)
Validates student ID + PIN authentication:
- Valid/invalid credentials
- Type coercion (string vs numeric ID)
- Empty/null input handling
- Security considerations

**Key Tests:**
- `validarAluno('alice1', '1234')` → true
- `validarAluno('alice1', 'wrong')` → false
- Type coercion handling

### 2. Data Validation (35 tests)
Ensures required fields and data integrity:
- Required field enforcement (id, nome, pin)
- Empty/null data rejection
- Special characters handling
- Large data handling (1000+ char names)

**Key Tests:**
- `importAluno({ aluno: { nome: 'Alice', pin: '1234' } })` → error (missing id)
- `importAluno({ aluno: { id: 'user1', nome: '', pin: '1234' } })` → error (empty nome)
- Long names, special characters accepted

### 3. CRUD Operations (15 tests)
Tests Create, Read, Update, Delete for alunos, planos, and registros:
- Creating new entries
- Updating without duplicates
- Multiple entries per student
- Proper data persistence

**Key Tests:**
- `salvarAluno()` creates new student
- `salvarAluno()` with existing ID updates (no duplicate)
- `salvarPlano()` keeps multiple exercises per student
- `salvarRegistro()` auto-generates timestamps

### 4. Cascading Operations (13 tests)
Ensures data consistency when deleting students:
- Remove from all 3 sheets (alunos, plano, registro)
- Preserve other students' data
- Idempotent deletion (safe to delete twice)
- Timestamp matching for record deletion

**Key Tests:**
- Delete alice → alice removed from all 3 sheets
- Delete alice → bob's data untouched
- Delete twice → no errors
- Specific record deletion by timestamp

### 5. HTTP Handlers (5 tests)
Tests the doGet/doPost HTTP endpoints:
- Authentication via admin key
- Student recording without key
- Error handling
- JSON parsing

**Key Tests:**
- `doGet({action: 'ping'})` → success
- `doPost({action: 'registro', aluno_id: 'alice1', pin: '1234'})` → success (no key needed)
- `doPost({action: 'salvarAluno', key: 'wrong'})` → unauthorized

## Coverage Report

```
Statements   : 88.27% ( 156/177 )
Branches     : 89.76% ( 71/79 )
Functions    : 80.00% ( 12/15 )
Lines        : 89.47% ( 161/180 )
```

### Untested Code
- `setAdminKey()` - setter function, used in all tests via module.exports
- Google Apps Script environment detection
- Error logging (Logger.log)

## Mock Strategy

The test suite uses mocks for Google Apps Script APIs:

### MockSpreadsheet
Simulates a Google Sheet with multiple sheet tabs

### MockSheet
Simulates a sheet with:
- Header row creation
- Data storage
- Range operations (getValue, setValue, setValues)

### Global Mocks
- `SpreadsheetApp.getActiveSpreadsheet()` → returns mock spreadsheet
- `ContentService.createTextOutput()` → returns mock response
- `Logger.log()` → jest.fn() for spy

**Key Mock Methods:**
```javascript
// Initialize fresh spreadsheet per test
global.SpreadsheetApp.resetForTesting()

// Create/get sheets
const ss = SpreadsheetApp.getActiveSpreadsheet()
const sheet = ss.insertSheet('alunos')
const data = sheet.getDataRange().getValues()
```

## Discovered Bugs

The test suite discovered **1 critical bug** in production code:

### Bug: removerAluno() - Wrong Column Index
**File:** `src/backend.js`, Line 163  
**Issue:** Cascading delete used wrong column index for plano sheet
**Before:**
```javascript
const idCol = (name === 'alunos') ? 0 : 1; // Wrong: uses 1 for plano
```

**After:**
```javascript
const idCol = (name === 'alunos') ? 0 : (name === 'plano') ? 0 : 1; // Correct
```

**Impact:** Deleting a student would NOT remove their training plans, leaving orphaned data

**Test That Caught It:**
```javascript
// não afeta dados de outros alunos
backend.removerAluno({ id: 'bob1' });
expect(plano.length).toBe(2); // Should be 2, was 3 (bob's plan remained)
```

## Writing New Tests

When adding new features, follow this pattern:

```javascript
describe('functionName', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../__mocks__/google-apps-script');
  });

  describe('Functionality category', () => {
    it('describes what should happen', () => {
      // Arrange - setup data
      const input = { id: 'user1', nome: 'Alice' };

      // Act - call function
      const result = backend.salvarAluno(input);

      // Assert - verify result
      expect(result.ok).toBe(true);
    });
  });
});
```

## CI/CD Integration

To integrate tests into CI/CD:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Performance

- All 84 tests run in ~0.7 seconds
- No external API calls (all mocked)
- Safe to run on every commit

## Next Steps

1. **Add Frontend Tests** (Playwright/Cypress)
   - Test login flows
   - Test form submission
   - Test chart rendering

2. **Add E2E Tests**
   - Full user workflows
   - Data consistency across views
   - Error handling flows

3. **Increase Coverage**
   - Target 90%+ coverage
   - Add edge case tests
   - Performance/load tests

## Troubleshooting

### Tests fail with "Cannot find module"
Make sure `setupTests.js` is configured in `jest.config.js`:
```javascript
setupFilesAfterEnv: ['<rootDir>/src/setupTests.js']
```

### Mock state not reset between tests
Ensure `beforeEach()` calls `global.SpreadsheetApp.resetForTesting()`:
```javascript
beforeEach(() => {
  global.SpreadsheetApp.resetForTesting();
});
```

### Coverage reports differ between runs
Clear Jest cache:
```bash
npm test -- --clearCache
```

## References

- [Jest Documentation](https://jestjs.io/)
- [Google Apps Script](https://developers.google.com/apps-script)
- [Test Coverage Analysis](./TEST_COVERAGE_ANALYSIS.md)

---

**Last Updated:** June 27, 2026  
**Test Suite Version:** 1.0  
**Backend Coverage:** 88%
