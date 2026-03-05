# Security Testing Evidence (Phase 3)

This repository includes automated security checks for thesis evidence:

## 1) Security Unit Tests
- Runner: Node built-in test runner (`node --test`)
- Files:
  - `test/inputSecurity.test.js`
  - `test/jwt.test.js`
- Command:
```bash
npm run test:security
```

## 2) SAST Baseline Scan
- Script: `scripts/security-sast.js`
- Checks for:
  - `eval(...)`
  - `new Function(...)`
  - `sequelize.query(...)` usage
  - likely hardcoded API keys
  - likely hardcoded secrets in source code
- Command:
```bash
npm run security:sast
```
- Output report:
  - `security-reports/sast-report.json`

## 3) Dependency Security Scan
- Command:
```bash
npm run security:deps
```
- Uses npm audit with threshold `high`.

## 4) CI Pipeline
- Workflow file:
  - `.github/workflows/security-ci.yml`
- Runs tests + SAST + dependency audit on `push` and `pull_request`.

## Notes
- Ensure `JWT_SECRET` is configured in `.env` and in GitHub Secrets (`JWT_SECRET`) for CI.
- If dependency scan fails, update vulnerable packages and rerun.

## Phase 4 Remediation Summary (2026-03-05)
- Updated vulnerable dependencies:
  - `axios` -> latest
  - `multer` -> latest
  - `@langchain/community` -> latest
  - `puppeteer` -> latest
- Removed vulnerable dependencies with unresolved issues:
  - `xlsx` (replaced by `read-excel-file`)
  - `xmldom`
  - `pg-hstore`
- Refactored Excel import implementation:
  - `src/controllers/estudiante.controller.js` now parses XLSX with `read-excel-file/node`.

## Phase 5 Remediation Summary (2026-03-05)
- Applied non-breaking dependency remediation with npm audit fix (`--legacy-peer-deps`).
- Removed `java-parser` dependency and refactored Java syntax validation in:
  - `src/controllers/evaluacion.controller.js`
- Result:
  - Removed vulnerability sources previously associated with `java-parser/chevrotain/lodash-es`.

## Current Security Baseline
- `npm run test:security`: PASS
- `npm run security:sast`: PASS (0 high/critical)
- `npm run security:deps`: PASS for threshold `--audit-level=high`
- `npm audit --omit=dev`: 1 moderate vulnerability remaining (`lodash` transitive)

At this point there are no High/Critical vulnerabilities reported by npm audit (production dependencies), and moderate findings were reduced from 8 to 1.
