# FORJA — CI/CD Pipeline

## Overview

Automated testing and quality checks run on every commit using GitHub Actions.

**Status:** Tests run on push to `main` and `claude/**`, and on all PRs

## Pipeline Stages

```
┌─────────────────────────────────────────────────────────┐
│ Triggered by: push to main/claude/**, or PR to main     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Backend Unit Tests (Node 18.x, 20.x)                    │
│ • Runs: npm test                                        │
│ • Threshold: 70% coverage                               │
│ • Time: ~30s per version                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ E2E Tests                                               │
│ • Runs: npm run test:e2e                                │
│ • Browser: Chromium                                     │
│ • Time: ~45s                                            │
│ • Artifacts: HTML report                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Coverage Report                                         │
│ • Generates: LCOV report                                │
│ • Uploads to: Codecov                                   │
│ • PR Comment: Coverage summary                          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ ✅ All Checks Passed → Can Merge                        │
│ ❌ Any Failure → Blocks Merge                           │
└─────────────────────────────────────────────────────────┘
```

## Workflow File

**Location:** `.github/workflows/tests.yml`

### Trigger Events
- `push` to `main` or `claude/**` branches
- `pull_request` to `main` branch

### Matrix Testing
Runs tests against:
- Node.js 18.x
- Node.js 20.x

This ensures compatibility across versions.

## Jobs Breakdown

### 1. Backend Tests (`backend-tests`)
```yaml
runs-on: ubuntu-latest
matrix:
  node-version: [18.x, 20.x]
```

**Steps:**
1. Checkout code
2. Setup Node.js
3. Install dependencies (`npm ci`)
4. Run backend unit tests (`npm test`)
5. Generate coverage report
6. Upload to Codecov
7. Verify 70% coverage threshold

**Failure if:**
- ❌ Any test fails
- ❌ Coverage < 70%

### 2. E2E Tests (`e2e-tests`)
```yaml
runs-on: ubuntu-latest
needs: backend-tests  # Runs after backend tests pass
```

**Steps:**
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Install Playwright browsers
5. Run E2E tests (`npm run test:e2e`)
6. Upload Playwright report (always)

**Artifacts:**
- `playwright-report/` (30 day retention)
  - Screenshots (failure only)
  - HTML report
  - Test traces

**Failure if:**
- ❌ Any E2E test fails

### 3. Coverage Report (`coverage-report`)
```yaml
runs-on: ubuntu-latest
needs: backend-tests
if: always()  # Runs even if tests fail
```

**Steps:**
1. Generate coverage report
2. Display coverage metrics
3. Comment on PR with summary (if PR)

**PR Comment Example:**
```
📊 **Coverage Report**

- Lines covered: `161`

[View detailed report](https://...)
```

## Configuration Details

### Coverage Threshold
```yaml
- Coverage must be >= 70%
- Checked after each test run
- Non-blocking warning if below threshold
```

### Codecov Integration
```yaml
- Flag: `backend`
- Name: `backend-coverage`
- Fail CI: false (non-blocking)
```

### Playwright Configuration
```yaml
- Browser: Chromium only
- Base URL: http://localhost:3000
- Screenshots: Failure only
- Traces: On first retry
```

## Status Checks

All jobs must pass for a PR to be mergeable:

| Job | Pass | Fail |
|-----|------|------|
| Backend Unit Tests | ✅ | ❌ |
| E2E Tests | ✅ | ❌ |
| Coverage Report | ⚠️ | ⚠️ |
| All Tests | ✅ | ❌ |

## Local Development

### Run tests before pushing
```bash
# Full test suite locally
npm run test:all

# Or separately
npm test                 # Backend unit tests
npm run test:e2e         # E2E tests
npm run test:coverage    # Coverage report
```

### Match CI environment locally
```bash
# Use same Node version as CI
nvm use 20

# Run with same commands
npm test && npm run test:e2e
```

## Debugging CI Failures

### Check CI logs
1. Go to [GitHub Actions](https://github.com/younobody/Forja/actions)
2. Click the failed workflow
3. Expand the failed step
4. Read error message

### Common Failures

**Backend tests fail:**
```
✗ 1 test failed
  ├ Line coverage < 70%
  └ Unit test error
```
→ Fix in `src/backend.js` or `src/__tests__/`

**E2E tests fail:**
```
✗ 1 test failed
  ├ Timeout: page.waitForURL
  └ Element not found
```
→ Fix in `e2e/main.spec.ts` or `e2e/test-server.js`

**Coverage low:**
```
Line coverage: 65% (below 70% threshold)
```
→ Add tests for uncovered lines in `src/__tests__/`

## Performance

| Stage | Time | Parallel |
|-------|------|----------|
| Setup (all) | ~10s | N/A |
| Backend Tests (18.x) | ~30s | ✅ |
| Backend Tests (20.x) | ~30s | ✅ |
| E2E Tests | ~45s | After backend |
| Coverage Report | ~15s | After backend |
| **Total** | **~95s** | Optimized |

## Future Improvements

### Quick Wins
1. **Cache dependencies** → Save ~20s
   ```yaml
   - uses: actions/setup-node@v4
     with:
       cache: 'npm'
   ```
   ✅ Already implemented

2. **Parallel Node versions** → Run 18.x & 20.x in parallel
   ✅ Already implemented via matrix

3. **Only run E2E if backend passes** → Skip E2E on backend failure
   ✅ Already implemented via `needs`

### Medium Effort
4. **Visual regression tests** → Detect UI changes
5. **Performance benchmarks** → Track speed over time
6. **Security scanning** → Dependency vulnerabilities

### Advanced
7. **Deploy on success** → Auto-deploy to staging
8. **Automatic version bumps** → Semantic versioning
9. **Release notes** → Auto-generate from commits

## Badges

Add to README.md to show CI status:

```markdown
[![Tests](https://github.com/younobody/Forja/actions/workflows/tests.yml/badge.svg)](https://github.com/younobody/Forja/actions)
[![Coverage](https://codecov.io/gh/younobody/Forja/branch/main/graph/badge.svg)](https://codecov.io/gh/younobody/Forja)
```

Renders as:
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)](https://github.com/)
[![Coverage](https://img.shields.io/badge/Coverage-88%25-brightgreen)](https://codecov.io/)

## Troubleshooting

### Workflow not triggering
**Check:**
1. File at `.github/workflows/tests.yml` exists
2. Commit includes this file
3. Branch matches trigger condition

**Fix:**
```bash
git add .github/workflows/tests.yml
git commit -m "Add CI/CD workflow"
git push
```

### Tests pass locally but fail in CI
**Causes:**
1. Different Node version
2. Different environment variables
3. Timing issues (network latency)

**Fix:**
```bash
# Test with CI Node version
nvm use 20
npm ci  # Clean install (same as CI)
npm run test:all
```

### Playwright browsers missing
**Symptom:** `Error: ENOENT: no such file or directory, stat '.../chromium'`

**Fix:**
```bash
# Add to CI or locally
npx playwright install --with-deps
```

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Codecov Integration](https://docs.codecov.io/docs/github-actions-integration)
- [Playwright CI Setup](https://playwright.dev/docs/ci)

---

**Last Updated:** June 27, 2026  
**Workflow Version:** 1.0  
**Status:** Active
