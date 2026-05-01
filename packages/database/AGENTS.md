## Database Package Overview

This package owns Prisma schema, migrations, generated client exports, and database-related utilities.

## Prisma Schema Rules

- Treat Prisma schema as the database model, not the public API contract.
- Do not expose Prisma models directly to frontend contracts by default.
- Keep database naming and relation design intentional.
- Consider indexes for common lookup fields.
- Consider constraints and relation behavior before changing schema.

## Migration Rules

- Use create-only migration workflow when available.
- Inspect generated SQL before applying.
- Do not edit already-applied migrations unless explicitly instructed.
- Do not run destructive reset/drop commands without approval.
- For non-null columns on existing tables, consider expand-contract/backfill strategy.
- For renames, avoid drop-and-recreate unless explicitly approved.

## Generated Client Rules

- Do not edit generated Prisma client output.
- Run generate after schema changes.
- Ensure dependent packages compile after schema changes.

## Public Contract Boundary

- API response DTOs should be defined in the API/contracts layer.
- Database models can inform API response DTOs, but should not automatically become them.
