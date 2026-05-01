## App Overview

This is the Vite React + TypeScript app using TanStack Router and Tailwind CSS.

## Frontend Architecture

- Keep route files thin.
- Put feature-specific code under `src/features/<feature-name>`.
- Prefer this structure for features when useful:
  - `feature-page.tsx`
  - `components/`
  - `hooks/`
  - `lib/`
  - `types.ts`
  - `index.ts`
- Keep feature-specific components inside the feature folder.
- Move components to `apps/app/src/shared/ui` or `packages/ui` only after real reuse exists.
- Reuse existing UI components before creating new primitives.

## React Refactor Rules

Before refactoring a large component, identify:
- mixed responsibilities
- state ownership
- data ownership
- side effects
- derived state
- conditional rendering
- accessibility risks
- test coverage gaps

Prefer:
- container/page + presentational components
- controlled component APIs
- small custom hooks for local reusable behavior
- pure helpers for testable derived logic

Avoid:
- large rewrites
- premature shared abstractions
- unnecessary compound components
- unnecessary context/reducers
- importing mock data inside reusable UI components
- changing behavior during readability-only refactors

## State And Data Ownership

- Page/container components own feature-level state.
- Presentational components receive values and callbacks.
- Components may own local DOM behavior such as refs, scrolling, and focus bookkeeping.
- If the parent owns `isOpen`, the child should be controlled with props such as `isOpen`, `onClose`, `onToggle`, or `onOpenChange`.
- Mock/demo data should be imported by the feature page/container and passed down as props.

## Accessibility

- Do not leave focusable children inside hidden `aria-hidden` containers.
- Do not rely only on `pointer-events-none`, opacity, transform, or scale to hide interactive UI.
- Use unmounting, `inert`, disabled tab stops, or proper focus management for hidden panels.
- Toggle buttons should use `aria-expanded`.
- Use `aria-controls` when toggling a specific panel.
- Disabled or visual-only controls should not appear fully interactive.

## Testing

Use the lightest reliable test level.

- Use Vitest for pure helpers, hooks, and small component tests.
- Use React Testing Library and user-event for user-oriented component tests.
- Use Playwright for page-level smoke/e2e tests.
- Do not test internal component structure.
- Do not use ad-hoc Chrome DevTools WebSocket scripts.

For UI refactors, verify:
- route renders
- main interactions still work
- controlled inputs update visible output
- hidden panels are not keyboard-focusable
- mobile smoke behavior still works
- typecheck/lint/build pass