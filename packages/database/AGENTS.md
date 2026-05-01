## Database Package Overview

This package owns Prisma schema, migrations, generated client exports, and database-related utilities.

## Prisma Schema Rules

- Treat Prisma schema as the database model, not the public API contract.
- Do not expose Prisma models directly to frontend contracts by default.
- Do not use Prisma generated types as controller response contracts by default.
- Keep database naming and relation design intentional.
- Consider indexes for common lookup fields.
- Consider constraints and relation behavior before changing schema.
- Treat soft-delete, audit, foreign-key, and relation fields as database internals unless the API contract explicitly includes them.

## Migration Rules

- Use create-only migration workflow when available.
- Inspect generated SQL before applying.
- Do not edit already-applied migrations unless explicitly instructed.
- Do not run destructive reset/drop commands without approval.
- Do not run `prisma migrate reset`, drop tables, truncate data, or delete migration history without explicit approval.
- For non-null columns on existing tables, consider expand-contract/backfill strategy.
- For renames, avoid drop-and-recreate unless explicitly approved.
- Include rollback or remediation notes for risky production migrations.

## Generated Client Rules

- Do not edit generated Prisma client output.
- Run generate after schema changes.
- Ensure dependent packages compile after schema changes.
- Keep generated files out of hand-authored contract changes.

## Public Contract Boundary

- API response DTOs should be defined in the API/contracts layer.
- Database models can inform API response DTOs, but should not automatically become them.
- Do not expose database table names, relation names, soft-delete markers, audit fields, or foreign keys as public API fields unless that is an intentional product/API decision.
- Map Prisma results to explicit API DTOs at the API boundary when returning data to frontend clients.

## Do Not

- Do not modify Prisma schema or migrations unless the task explicitly asks for a database change.
- Do not edit generated Prisma client files.
- Do not use Prisma model shape as proof that an API field is public.
- Do not expose DB internals in generated OpenAPI schemas by default.
- Do not run destructive database commands without explicit approval.
