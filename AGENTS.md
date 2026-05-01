## Repo Overview

- Monorepo managed with Turborepo and Yarn 4.
- Apps:
  - `apps/app`: Vite React + TypeScript app.
  - `apps/api`: NestJS + TypeScript API.
  - `apps/web`: Next.js app.
  - `apps/docs`: Next.js docs app.
- Packages:
  - `packages/database`: Prisma schema, migrations, generated client exports.
  - `packages/ui`: shared React UI components.
  - `packages/eslint-config`, `packages/typescript-config`: shared config.

## Package Manager

- Use `yarn`.
- Do not introduce another package manager.
- Ask before adding production dependencies.

## Common Commands

- Install: `yarn install`
- Dev all: `yarn dev`
- Local dev with DB: `yarn dev:local`
- Build: `yarn build`
- Lint: `yarn lint`
- Typecheck: `yarn check-types`
- Format: `yarn format`
- Start DB: `yarn db:up`
- Create migration only: `yarn db:migrate`
- Apply local migrations: `yarn db:apply`
- Generate Prisma client: `yarn db:generate`
- Seed: `yarn db:seed`

## Frontend Conventions

- Prefer existing components from `packages/ui` and `apps/app/src/shared/ui`.
- Use React function components and TypeScript.
- Keep UI state local unless shared state is needed.
- Use existing routing/query/form patterns before adding new ones.
- Preserve accessibility: labels, keyboard behavior, semantic HTML.
- Do not create one-off design-system replacements.

## Frontend Refactor Conventions

- For route/page refactors, prefer:
  - thin route files
  - feature-level page/container components
  - focused presentational components
  - small custom hooks for reusable local behavior
  - pure helpers for derived logic that needs testing
- Prefer controlled component APIs for editors, forms, panels, and toggles.
- Page/container components should own feature-level state and pass values/callbacks down.
- Do not import mock/demo data inside reusable UI components; pass data through the feature page/container unless there is a clear reason not to.
- Do not use compound components just because they are popular.
- Use compound components only for reusable component families with shared internal state and flexible composition.
- Use reducer/context only when state transitions or prop drilling justify it.
- Use state machines only for complex explicit UI states.
- Move code to `packages/ui` only after there is real reuse outside one feature.

## Frontend Accessibility Rules

- Do not hide focusable UI using only opacity, transform, pointer-events, or aria-hidden.
- If a hidden panel contains focusable children, unmount it, use `inert`, or implement proper focus management.
- Toggle buttons should use `aria-expanded`; use `aria-controls` when toggling a specific panel.
- Inputs need visible labels, `aria-label`, or `aria-labelledby`.
- Visual-only or unavailable controls must be disabled or clearly non-interactive.
- Test user-visible behavior rather than implementation details.

## Backend Conventions

- Follow existing Nest module/controller/service structure.
- Keep controllers thin; put business logic in services.
- Validate request boundaries.
- Return typed DTOs/contracts.
- Do not leak internal errors or secrets in responses.

## Prisma Conventions

- Prisma schema lives in `packages/database/prisma/schema.prisma`.
- Migrations live in `packages/database/prisma/migrations`.
- Prefer `yarn db:migrate` for create-only migrations, then inspect SQL.
- Never use destructive migration/reset commands without explicit approval.
- Do not edit applied migration files unless the user explicitly asks.
- Consider backfills/expand-contract for non-null columns and renames.

## Generated API Client

- Do not manually edit files under `src/lib/api-client/generated`.
- Update backend DTO/OpenAPI first.
- Run `yarn workspace app api:generate`.
- Commit generated changes together with backend contract changes.

## Zod Conventions

- Use Zod for runtime validation at trust boundaries.
- Infer TypeScript types from Zod schemas where practical.
- Avoid duplicating equivalent DTO/schema logic across frontend/backend.
- Keep shared contracts in a shared package if both client and server need them. [FILL IN PACKAGE NAME]

## Testing And Checks

- Always run relevant targeted checks after code changes.
- Before completion, run:
  - `yarn check-types`
  - `yarn lint`
  - relevant package tests/builds
- For frontend changes in `apps/app`, prefer:
  - `yarn workspace app check-types`
  - `yarn workspace app lint`
  - `yarn workspace app test`
  - `yarn workspace app build`
- For UI behavior, use Playwright when configured.
- Do not use ad-hoc Chrome DevTools WebSocket scripts for UI verification.
- If automated UI tests do not exist yet, provide manual QA steps instead of inventing one-off browser scripts.
- Report existing unrelated failures separately.

## Definition Of Done

- Code compiles and typechecks.
- Lint passes or reported exceptions are explicit.
- Tests cover changed behavior.
- API/database changes include migration/contract notes.
- UI changes reuse existing components and remain responsive/accessibile.
- Final response reports files changed, checks run, and any risks.

## Do Not

- Do not commit secrets, `.env` values, tokens, or credentials.
- Do not run destructive DB commands without approval.
- Do not change unrelated files.
- Do not silently add dependencies.
- Do not bypass TypeScript with `any` unless justified.
- Do not invent architecture when an existing repo pattern exists.
