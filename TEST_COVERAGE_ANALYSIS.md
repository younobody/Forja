# FORJA — Test Coverage Analysis & Improvement Plan

**Analysis Date:** June 22, 2026  
**Project:** FORJA Coach Dashboard  
**Current Coverage:** 0% (no tests found)

---

## Executive Summary

FORJA is a coaching dashboard consisting of:
- **Frontend:** Single-page HTML/CSS/JavaScript application with 5+ views
- **Backend:** Google Apps Script API handling authentication, CRUD operations, and data persistence
- **Status:** Production-ready but completely untested

This document identifies critical gaps in test coverage and proposes a prioritized testing strategy.

---

## Codebase Overview

### Backend (Google Apps Script) — ~303 lines
**File:** `forja_apps_script.gs`

#### Functions by Category:

**Routing & API (5 functions)**
- `doGet()` - HTTP GET handler with action routing
- `doPost()` - HTTP POST handler with action routing
- `jsonResponse()` - Response formatting
- `setup()` - Initial schema creation

**Data Access (2 functions)**
- `getSheet()` - Sheet retrieval/creation with schema initialization
- `sheetToObjects()` - Convert sheet rows to JavaScript objects

**Authentication (1 function)**
- `validarAluno()` - Student ID + PIN validation

**Read Operations (2 functions)**
- `getAluno()` - Fetch student data + plan + records
- `getAdmin()` - Fetch all students, plans, records

**Write Operations (6 functions)**
- `salvarRegistro()` - Record a workout session
- `salvarPlano()` - Update training plan for student
- `salvarAluno()` - Create/update student profile
- `removerAluno()` - Delete student + cascade delete related data
- `removerRegistro()` - Delete workout record by timestamp
- `importAluno()` - Bulk import student + plan + records
- `substituirRegistros()` - Replace all records for a student

### Frontend (HTML/JavaScript) — ~1354 lines
**File:** `forja.html`

#### Views (5 sections)
1. **#view-config** - API URL configuration
2. **#view-home** - Student login (ID + PIN)
3. **#view-trainer-login** - Trainer authentication
4. **#view-trainer** - Trainer dashboard (list students, stats)
5. **#view-edit-aluno** - Edit student (profile, plan, progress charts)
6. **#view-aluno** - Student workout recording view (implied)

#### Key Functions (identified)
- `apiGet()`, `apiPost()` - HTTP communication
- `loadTrainerData()` - Fetch all students
- `loadEditAluno()` - Load single student for editing
- `loadAlunoData()` - Load student workout view
- Navigation, form handling, chart rendering (Chart.js)

---

## Critical Testing Gaps

### 🔴 Backend — High Priority

#### 1. Authentication & Authorization (CRITICAL)
**Risk Level:** HIGH — Application-level security  
**Functions:** `validarAluno()`, `doGet()`, `doPost()`

**Missing Tests:**
- ✗ Valid ID + PIN authentication succeeds
- ✗ Invalid PIN rejects access
- ✗ Missing ID rejects access
- ✗ Admin key validation on protected endpoints
- ✗ Public endpoints (`ping`) don't require auth
- ✗ Student `registro` action allows ID+PIN auth only
- ✗ Type coercion in string comparison (string ID vs numeric ID)

**Example Failures Not Caught:**
- Attacker passes `id=1&pin=""` → may match on loose comparison
- Swapped parameters break authentication
- Admin key leaked in logs

---

#### 2. Data Validation (CRITICAL)
**Risk Level:** HIGH — Data integrity  
**Functions:** `importAluno()`, `salvarAluno()`, `salvarRegistro()`, `salvarPlano()`

**Missing Tests:**
- ✗ Required fields enforced (aluno.id, nome, pin)
- ✗ Empty/null data handling
- ✗ Invalid data types (e.g., string carga on numeric field)
- ✗ Boundary values (extremely long strings, negative numbers)
- ✗ SQL injection vectors in data fields (unlikely in Sheets, but serialization risks)
- ✗ Timestamp format validation
- ✗ Boolean coercion in `completou` field

**Example Failures Not Caught:**
```javascript
importAluno({ aluno: { id: '', nome: 'Bob' } })  // Missing PIN, not caught
importAluno({ aluno: { id: '1', nome: '' } })    // Empty name, not caught
salvarRegistro({ aluno_id: null, ... })          // NULL in key field
```

---

#### 3. Data Persistence & Sheet Operations (HIGH)
**Risk Level:** HIGH — Data loss scenarios  
**Functions:** `getSheet()`, `sheetToObjects()`, `salvarPlano()`, `removerAluno()`, `substituirRegistros()`

**Missing Tests:**
- ✗ Sheet initialization on first call (headers created correctly)
- ✗ Empty sheets return empty array
- ✗ Rows with partial data filtered correctly
- ✗ Update operations (e.g., `salvarAluno()`) update existing row vs append
- ✗ Cascading delete removes from all 3 sheets
- ✗ Concurrent writes don't corrupt data
- ✗ Large datasets (100+ rows) perform correctly
- ✗ Timestamp conversion (Date object vs string)

**Example Failures Not Caught:**
```javascript
salvarAluno({ id: '1', nome: 'Alice', ... })    // First time: appends
salvarAluno({ id: '1', nome: 'Alice2', ... })   // Second time: appends again (duplicate!)
removerAluno({ id: '1' })                       // Does it remove from plano too?
```

---

#### 4. Business Logic (MEDIUM)
**Risk Level:** MEDIUM — Incorrect behavior  
**Functions:** `getAluno()`, `importAluno()`

**Missing Tests:**
- ✗ Sorting: plano sorted by day then order
- ✗ Sorting: registros sorted by timestamp (newest first)
- ✗ Record limit: only last 100 registros returned
- ✗ Filter: plano/registros filtered by aluno_id
- ✗ Import replaces entire plano/registros, preserves other students' data
- ✗ Import with missing plan array still succeeds

**Example Failures Not Caught:**
```javascript
// Plan not sorted by day
const plano = getAluno('1', '1234').plano
// Returns: [{dia:'C'}, {dia:'A'}, {dia:'B'}]  — expected sorted

// Registros from other students leak
removerAluno({ id: '1' })  // Removes student 1's registros but student 2's remain
```

---

#### 5. Error Handling (MEDIUM)
**Risk Level:** MEDIUM — Silent failures  
**Functions:** `doGet()`, `doPost()`, all functions

**Missing Tests:**
- ✗ Invalid JSON in POST body → graceful error
- ✗ Missing action parameter → clear error message
- ✗ Sheet API failures (quota exceeded, permission denied) → error response
- ✗ Unknown actions return 400-level error
- ✗ Exceptions caught and returned as JSON

---

### 🟡 Frontend — Medium Priority

#### 1. API Communication (HIGH)
**Risk Level:** HIGH — Backend integration  
**Functions:** `apiGet()`, `apiPost()`

**Missing Tests:**
- ✗ Successful API calls update UI
- ✗ Network errors handled gracefully
- ✗ Invalid credentials show error toast
- ✗ Admin key checked before sensitive operations
- ✗ Response parsing handles malformed JSON
- ✗ Timeout handling

---

#### 2. Authentication Flow (HIGH)
**Risk Level:** HIGH — User access  
**Functions:** `loadTrainerData()`, `loadAlunoData()`, login handlers

**Missing Tests:**
- ✗ Student login with valid ID+PIN → loads data
- ✗ Student login with invalid PIN → error toast
- ✗ Trainer login with valid key → dashboard
- ✗ Trainer login with invalid key → error toast
- ✗ Session persistence (localStorage)
- ✗ Logout clears session

---

#### 3. Form Handling & Validation (MEDIUM)
**Risk Level:** MEDIUM — Data entry errors  
**Functions:** Form submissions (profile, plan, record)

**Missing Tests:**
- ✗ PIN field accepts only numeric input
- ✗ Exercise table rows can be added/removed
- ✗ Save operations validate required fields client-side
- ✗ Unsaved changes warning (if implemented)
- ✗ Form state reset after successful save

---

#### 4. Data Transformation (MEDIUM)
**Risk Level:** MEDIUM — Display accuracy  

**Missing Tests:**
- ✗ Workout records displayed in reverse chronological order
- ✗ Plan grouped by day (A, B, C, D, E)
- ✗ Timestamps formatted correctly in UI
- ✗ Charts render correct data
- ✗ Stats calculations (7D sessions, active users) correct

---

#### 5. Navigation & Views (LOW)
**Risk Level:** LOW — UX issues  

**Missing Tests:**
- ✗ Navigation between views works correctly
- ✗ Back button returns to previous view
- ✗ Hidden views remain hidden
- ✗ Mobile responsiveness (layout shifts don't break functionality)

---

## Recommended Testing Strategy

### Phase 1: Backend Unit Tests (Week 1-2) — CRITICAL
**Tool:** [clasp](https://github.com/google/clasp) + Jest or similar  
**Estimated Coverage Gain:** +50%

**Priority Tests (Write First):**

1. **Authentication Tests**
   ```javascript
   describe('validarAluno', () => {
     it('accepts valid id + pin', () => { })
     it('rejects invalid pin', () => { })
     it('handles string/number coercion', () => { })
   })
   ```

2. **Data Validation Tests**
   ```javascript
   describe('importAluno', () => {
     it('rejects missing required fields', () => { })
     it('handles empty data gracefully', () => { })
   })
   ```

3. **CRUD Tests**
   ```javascript
   describe('salvarAluno', () => {
     it('creates new student', () => { })
     it('updates existing student', () => { })
     it('does not create duplicates', () => { })
   })
   ```

4. **Cascading Operations**
   ```javascript
   describe('removerAluno', () => {
     it('removes from alunos sheet', () => { })
     it('removes from plano sheet', () => { })
     it('removes from registro sheet', () => { })
     it('preserves other students data', () => { })
   })
   ```

---

### Phase 2: Frontend Integration Tests (Week 2-3) — HIGH
**Tool:** Playwright or Cypress  
**Estimated Coverage Gain:** +30%

**Priority Tests:**

1. **Login Flows**
   - Student login → data loads
   - Trainer login → dashboard displays
   - Invalid credentials → error shown

2. **CRUD Operations**
   - Add student → appears in list
   - Edit student → saved to backend
   - Delete student → removed from list

3. **Data Accuracy**
   - Charts display correct progression
   - Stats match backend data
   - Timestamps formatted correctly

---

### Phase 3: End-to-End Tests (Week 3-4) — MEDIUM
**Tool:** Playwright/Cypress  
**Estimated Coverage Gain:** +15%

**Priority Tests:**

1. **Complete Workflows**
   - Trainer creates student → student can login → student records workout → trainer sees stats
   - Import student from JSON → appears in list
   - Export student → can be reimported

2. **Edge Cases**
   - 100+ workouts in history → loads and displays
   - Special characters in names → persisted correctly
   - Large plan (10+ exercises) → saved correctly

---

### Phase 4: Regression Tests (Ongoing) — MEDIUM
**Coverage Gain:** Prevents regression

**Categories:**
- Security: Auth bypass attempts
- Data integrity: Cascading deletes, updates
- Performance: Large datasets

---

## Test Coverage Metrics

### Current State
| Layer | Functions | Tests | Coverage |
|-------|-----------|-------|----------|
| Backend API | 7 | 0 | 0% |
| Backend Data | 2 | 0 | 0% |
| Backend Logic | 5 | 0 | 0% |
| **Backend Total** | **14** | **0** | **0%** |
| Frontend API | 2 | 0 | 0% |
| Frontend Auth | 3 | 0 | 0% |
| Frontend Forms | 4+ | 0 | 0% |
| Frontend Views | 6+ | 0 | 0% |
| **Frontend Total** | **15+** | **0** | **0%** |
| **TOTAL** | **~30 functions** | **0** | **0%** |

### Target State (Phase 1-2)
| Layer | Target Coverage |
|-------|-----------------|
| Backend Auth | 95%+ |
| Backend Data Validation | 90%+ |
| Backend CRUD | 85%+ |
| Frontend Auth | 90%+ |
| Frontend API | 85%+ |
| **Overall** | **70%+** |

---

## Specific Areas for Improvement

### 🚨 Critical (Must Fix)

1. **Input Validation on Backend**
   - Validate `aluno.id`, `aluno.pin`, `aluno.nome` exist and are non-empty
   - Validate timestamp format
   - Validate numeric fields are actually numeric

2. **Authentication Hardening**
   - Ensure string comparison doesn't have type coercion bugs
   - Document PIN requirements (4-6 digits)
   - Never log admin key or PINs

3. **Cascading Delete Verification**
   - Ensure `removerAluno()` removes from all 3 sheets
   - Write comprehensive test to verify no data leakage

### 🟡 Important (Should Fix)

4. **Duplicate Prevention**
   - `salvarAluno()` should update existing, not append duplicate
   - Add test to verify idempotency

5. **Sorting Verification**
   - Verify plano sorted by day + order
   - Verify registros sorted by timestamp (newest first)
   - Add test with unsorted data

6. **Boundary Testing**
   - Large names (1000 chars) don't break sheets
   - Many registros (1000+) handled efficiently
   - Concurrent writes handled gracefully

### 🟢 Nice to Have

7. **Performance Tests**
   - Import 100+ students in <5s
   - Load trainer dashboard in <2s

8. **Accessibility & UX**
   - Mobile forms functional
   - Error messages clear and actionable

---

## Implementation Roadmap

### Week 1: Setup & Backend Foundation
- [ ] Set up test framework (Jest for Google Apps Script)
- [ ] Create mock SpreadsheetApp API
- [ ] Write 5-10 authentication tests
- [ ] Write 10-15 data validation tests

### Week 2: Backend Coverage
- [ ] Write 10-15 CRUD tests
- [ ] Write 5-10 cascading operation tests
- [ ] Write 5-10 error handling tests
- [ ] Achieve 70%+ backend coverage

### Week 3: Frontend Integration
- [ ] Set up Playwright/Cypress
- [ ] Write 5-10 login flow tests
- [ ] Write 5-10 CRUD operation tests
- [ ] Write 5-10 data accuracy tests

### Week 4: E2E & Polish
- [ ] Write complete workflow tests
- [ ] Performance/load tests
- [ ] Documentation & CI/CD integration
- [ ] Achieve 70%+ overall coverage

---

## Tools & Setup Recommendations

### Backend Testing
```bash
# Google Apps Script + Jest
npm install --save-dev @google/clasp jest

# Or: Use Postman for manual API testing
# (automate later with Newman)
```

**Mock Strategy:**
```javascript
// Mock SpreadsheetApp
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: jest.fn(),
    insertSheet: jest.fn(),
  }),
}
global.ContentService = { /* ... */ }
```

### Frontend Testing
```bash
npm install --save-dev playwright

# or
npm install --save-dev cypress
```

**Test Example:**
```javascript
test('trainer can login and see students', async ({ browser }) => {
  const page = await browser.newPage()
  await page.goto('http://localhost:8000/forja.html')
  await page.fill('#trainer-key', 'valid-key')
  await page.click('#btn-trainer-entrar')
  await page.waitForSelector('#trainer-alunos-list')
  // Assert students displayed
})
```

---

## Known Risks (Tested Issues)

If these scenarios **aren't tested**, they **will break in production:**

1. ✗ **Auth Bypass:** Attacker passes empty PIN → system compares "" to real PIN
2. ✗ **Data Duplication:** Saving student twice → duplicate rows created
3. ✗ **Data Leakage:** Deleting student → some records remain visible
4. ✗ **Cascading Failures:** Import with missing plan → undefined errors
5. ✗ **UI Crashes:** Large dataset (100+ rows) → frontend hangs
6. ✗ **Silent Failures:** Network error → user sees no feedback
7. ✗ **Timezone Issues:** Timestamp comparison → records sorted incorrectly

---

## Success Criteria

**Phase 1 Complete When:**
- ✓ Authentication tests pass (valid/invalid scenarios)
- ✓ Data validation tests pass (required fields enforced)
- ✓ CRUD tests pass (create/read/update/delete work correctly)
- ✓ Cascading delete verified (all sheets cleaned)
- ✓ Backend coverage ≥ 70%

**Overall Complete When:**
- ✓ Backend + Frontend coverage ≥ 70%
- ✓ All critical bugs identified & fixed
- ✓ CI/CD runs tests on every commit
- ✓ Test documentation written for maintainers

---

## Notes for Maintainers

1. **Google Apps Script Limitations:** No native jest support; use mocks heavily
2. **Sheet API Costs:** Tests should use mocks, not live sheets (quota concerns)
3. **Timing:** Async operations in Apps Script require careful handling
4. **Documentation:** Every test should explain the business rule being validated

---

## Appendix: Sample Test Cases

### Backend: Authentication
```javascript
describe('validarAluno', () => {
  it('returns true for valid id + pin', () => {
    // Setup: mock sheet with aluno id:'1' pin:'1234'
    expect(validarAluno('1', '1234')).toBe(true)
  })

  it('returns false for invalid pin', () => {
    expect(validarAluno('1', '9999')).toBe(false)
  })

  it('returns false for missing id', () => {
    expect(validarAluno('999', '1234')).toBe(false)
  })

  it('handles numeric id comparison', () => {
    // Both '1' and 1 should match
    expect(validarAluno(1, '1234')).toBe(true)
  })
})
```

### Backend: Data Validation
```javascript
describe('importAluno', () => {
  it('rejects aluno without id', () => {
    const result = importAluno({
      aluno: { nome: 'Bob', pin: '1234' },
      plano: []
    })
    expect(result.error).toContain('id')
  })

  it('accepts aluno with minimal data', () => {
    const result = importAluno({
      aluno: { id: 'bob1', nome: 'Bob', pin: '1234' },
      plano: []
    })
    expect(result.ok).toBe(true)
  })
})
```

### Frontend: Login Flow
```javascript
test('student logs in successfully', async ({ page }) => {
  await page.goto('http://localhost:8000/forja.html')
  
  // Setup config
  await page.fill('#config-url', 'https://...')
  await page.click('#btn-config-save')
  
  // Login
  await page.fill('#home-pin', '1234')
  await page.click('#btn-home-entrar')
  
  // Verify: workout view shown
  await page.waitForSelector('#view-aluno:not(.hidden)')
})
```

---

**Document Version:** 1.0  
**Last Updated:** June 22, 2026  
**Status:** Ready for Implementation
