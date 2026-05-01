---
name: react-a11y-review
description: Use when reviewing React UI for accessibility issues, especially hidden panels, buttons, forms, focus behavior, aria attributes, dialogs, menus, and keyboard navigation.
---

# React Accessibility Review Skill

Review React UI for practical accessibility issues.

## Check

1. Hidden UI
   - Do not leave focusable children inside aria-hidden containers.
   - Do not rely only on opacity, transform, or pointer-events to hide interactive UI.
   - Use unmounting, inert, disabled tab stops, or proper focus management.

2. Buttons and controls
   - Buttons need accessible names.
   - Visual-only controls should be disabled or clearly marked.
   - Toggle buttons should use aria-expanded.
   - Use aria-controls when toggling a specific panel.

3. Forms
   - Inputs need labels, aria-label, or aria-labelledby.
   - Read-only inputs should not look fully interactive unless intentional.
   - Disabled/unavailable actions should be disabled.

4. Panels/dialog-like UI
   - If it behaves like a dialog, consider role/dialog semantics and focus management.
   - If it is a non-modal floating panel, ensure keyboard behavior still makes sense.

5. Testing
   - Recommend Playwright + axe where relevant.
   - Prefer user-visible behavior checks.

## Output

Return:

- critical issues
- important issues
- minor issues
- suggested fixes
- whether the issue is blocking before merge
