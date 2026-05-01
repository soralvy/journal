---
name: frontend-verification
description: Use when verifying frontend changes after refactors, UI changes, route changes, form changes, or accessibility-sensitive updates.
---

# Frontend Verification Skill

Use project tooling. Do not use ad-hoc Chrome DevTools WebSocket scripts.

## Verification order

1. Typecheck
2. Lint
3. Unit/component tests
4. Playwright smoke/e2e tests
5. Accessibility checks if relevant
6. Build

## UI refactor checks

For page refactors, verify:
- page renders
- primary interactions still work
- controlled inputs update visible output
- toggled panels open/close
- hidden panels are not keyboard-focusable
- mobile smoke state works
- no unrelated behavior changed

## Output

Report:
- commands run
- results
- failures
- whether failures are related to current changes
- manual QA steps if automated coverage is missing