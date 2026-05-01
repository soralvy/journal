---
name: react-feature-refactor
description: Use when refactoring React feature/page code for readability, maintainability, component boundaries, state ownership, and production-quality structure without changing behavior.
---

# React Feature Refactor Skill

Use this skill when the user asks to refactor a React page, route, or feature component for readability or maintainability.

## Goal

Improve structure without changing behavior.

## Process

1. Inspect the current file and related imports.
2. Identify mixed responsibilities:
   - routing
   - page orchestration
   - data ownership
   - state ownership
   - presentational markup
   - side effects
   - mock/demo data
   - helpers/formatters
3. Evaluate architecture options:
   - simple extraction
   - feature folder
   - container + presentational components
   - custom hook
   - controlled component API
   - reducer/context
   - compound components
   - state machine
4. Recommend the simplest option that clearly improves readability.
5. Do not implement until the plan is clear, unless the user explicitly asks to proceed.

## Decision rules

- Prefer feature-folder + page/container + presentational components for page-level refactors.
- Prefer controlled components for editors/forms/panels.
- Extract hooks only for real state/side-effect logic.
- Extract helpers only for testable derived logic.
- Do not use compound components unless the UI is becoming a reusable component family.
- Do not move to shared/ui unless there is reuse outside this feature.
- Do not import mock/demo data inside reusable UI components.
- Preserve visuals, behavior, routing, and data shape.

## Output before editing

Return:

1. current responsibilities
2. recommended architecture
3. rejected patterns and why
4. proposed file structure
5. state/data ownership plan
6. a11y risks
7. test/verification plan
8. step-by-step implementation plan

## Done when

- behavior remains unchanged
- file boundaries are clearer
- components have meaningful names
- state/data ownership is explicit
- relevant checks are run
- remaining risks are reported
