# API Agent Guidelines

## API App Overview

This is the NestJS + TypeScript API app.

The API should be designed as a stable public contract for frontend and generated clients.

Core principle:

- Prisma models are database shapes.
- NestJS DTOs and OpenAPI schemas are public API contracts.
- Do not expose Prisma models directly unless they are intentionally mapped to public response DTOs.

## NestJS Structure

Follow existing NestJS conventions:

- Controllers handle HTTP concerns only.
- Services contain business logic.
- Repositories or data-access code handle database access if the repo uses that pattern.
- Keep controllers thin.
- Keep request validation at API boundaries.
- Keep response mapping explicit.

## Request DTO Rules

For every create/update endpoint:

- Use an explicit request DTO.
- Prefer Zod-backed DTOs via `createZodDto` when the module already uses `nestjs-zod`.
- Request DTOs should validate external input.
- Do not rely on TypeScript types alone for runtime validation.
- Do not duplicate equivalent request validation logic in multiple places.
- Keep request DTO names explicit.
- DTO class names are part of generated client readability; avoid generic names like `BodyDto`.
- Document request body examples only when they clarify edge cases or expected shape.

Examples:

- `CreateJournalDto`
- `UpdateJournalDto`
- `LoginRequestDto`

## Response DTO Rules

For every public endpoint:

- Use an explicit response DTO or schema.
- Do not return raw Prisma models as the public API contract by default.
- Do not create fake entity classes that can drift from Prisma or the public API contract.
- Response DTOs should include only fields that are intentionally public.
- Map database results to response DTOs when needed.
- Keep response names explicit.
- Treat date/time fields as serialized API strings in the public contract, even if the service receives `Date` objects internally.
- Prefer one response DTO per stable public shape; do not reuse a database-oriented class just because the fields currently match.

Examples:

- `JournalResponseDto`
- `UserSessionResponseDto`
- `PaginatedJournalResponseDto`

## OpenAPI / Swagger Rules

Every endpoint intended for frontend use should have high-quality OpenAPI metadata.

For each endpoint, include:

- `@ApiTags(...)`
- `@ApiOperation(...)` when the generated operation name would otherwise be unclear.
- An explicit success response:
  - `@ApiOkResponse({ type: ... })`
  - `@ApiCreatedResponse({ type: ... })`
- Explicit common error responses where relevant:
  - `@ApiBadRequestResponse(...)`
  - `@ApiUnauthorizedResponse(...)`
  - `@ApiForbiddenResponse(...)`
  - `@ApiNotFoundResponse(...)`
  - `@ApiConflictResponse(...)`
- Stable operation names if configured or needed for code generation.
- Request body DTOs that OpenAPI can understand.
- Response DTOs that OpenAPI can understand.
- Error DTOs that match the global exception filter output.

Do not depend on ambiguous inferred schemas when code generation quality matters.

## API Error Contract

Prefer a consistent public error shape.

Recommended baseline:

```ts
type ApiErrorResponse = {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error: string;
  requestId: string;
};

type ApiValidationErrorResponse = {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error: string;
  requestId: string;
  fieldErrors: Record<string, string>;
};
```

Do not invent a new error shape per controller.

If changing the public error contract, stop and ask for approval.

## Zod Rules

When using Zod DTOs:

- Keep the Zod schema as the source of runtime validation.
- Export both the schema and DTO class when useful.
- Use `z.infer<typeof Schema>` for internal TypeScript types when needed.
- Ensure the global Zod validation pipe is configured.
- Ensure OpenAPI generation correctly understands Zod DTOs.
- Be careful with transforms like `.trim()` because they change input values at runtime.
- Do not rely on TypeScript-only DTO fields for Zod-backed request validation.
- If a Zod DTO is used in OpenAPI, verify the generated schema includes required fields, formats, min/max constraints, and examples where needed.

## Prisma Rules

- Prisma schema is not automatically the API contract.
- Do not expose internal database-only fields.
- Do not expose fields that should be private or unstable.
- Be explicit about Date serialization.
- Consider relation loading and N+1 risks.
- Do not create or edit migrations without explicit task scope.
- Never run destructive migration/reset commands without approval.

## Code Generation Readiness

When adding or changing endpoints, design them so frontend clients can be generated.

Checklist:

- Endpoint path is stable.
- HTTP method is correct.
- Request DTO is explicit.
- Response DTO is explicit.
- Date/time, nullable, optional, and enum fields are accurately represented.
- Error responses are documented.
- OpenAPI schema is accurate.
- Operation name is stable if codegen uses it.
- No raw internal implementation type leaks into OpenAPI.
- Generated frontend client should not require manual schema duplication.
- Validation error shape is documented.
- Auth requirements are documented.

## Code Quality Hierarchy

When changing code, optimize in this order:

1. Correctness, data safety, privacy, and security.
2. Clear domain model and honest TypeScript types.
3. Readability and maintainability for human reviewers.
4. Testability and deterministic behavior.
5. Lint/typecheck/build compliance.
6. Formatting.

Do not satisfy a lower-priority check by degrading a higher-priority quality.

Lint is a verification tool, not the design goal. If a lint rule appears to conflict with readable, type-correct code, do not contort the implementation just to make lint green.

## Internal Service Quality

For internal backend services:

- Keep controllers thin; services may orchestrate business logic.
- Separate orchestration from pure domain helpers when logic becomes heuristic or non-trivial.
- Prefer small domain-specific helper files over generic `utils.ts`.
- Do not use file-level ESLint disables.
- Use line-level ESLint disables only as a last resort with a concrete explanation.
- Do not use `any`.
- Prefer explicit return types on exported functions and public service methods.
- Prefer domain errors inside domain/helper layers.
- Map domain errors to HTTP exceptions at controller/API boundaries.
- Do not put HTTP-specific exceptions into low-level helpers unless this matches an existing module pattern.
- Keep Prisma query shapes explicit:
  - select only required fields;
  - filter by owner where applicable;
  - filter soft-deleted records where applicable.

## Review Checklist For New Endpoints

Before considering an endpoint done, check:

- Is the request DTO runtime-validated?
- Is the response DTO explicit?
- Is the OpenAPI response accurate?
- Are error responses documented?
- Is the service returning an internal DB shape or a mapped public shape?
- Would Orval, Hey API, or openapi-typescript generate a useful frontend client from this endpoint?
- Are auth and permissions handled?
- Are validation errors consistent?
- Are database errors converted to public errors safely?
- Are tests needed for controller/service behavior?

## Do Not

- Do not expose Prisma models directly as public contracts unless explicitly approved.
- Do not invent entity classes without checking the Prisma schema and intended public response.
- Do not use `any`.
- Do not silently change API response shape.
- Do not silently change error response shape.
- Do not implement product decisions while only fixing contract/codegen quality.
- Do not edit generated files directly.
