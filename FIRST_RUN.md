# First Run Guide

## 1) Prerequisites

- Node.js `>=18`
- Yarn `4` (project uses Yarn workspaces)
- Docker (for local Postgres)

## 2) Install dependencies

```bash
yarn install
```

## 3) Configure environment

Create a root `.env` file (if you don’t already have one) with at least:

```env
DATABASE_URL="postgresql://..."
CORS_ORIGINS="http://localhost:5173,http://localhost:3001"
BETTER_AUTH_URL="http://localhost:3000"
```

Optional (needed for Google/Resend auth flows):

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
RESEND_API_KEY="..."
```

## 4) Run everything locally

This starts Postgres, waits until it is ready, applies migrations, then starts the project:

```bash
yarn dev:local
```

## Manual commands

Use these only when you need to run each step separately.

### Start local database

```bash
yarn db:up
```

### Apply database migrations

```bash
yarn db:apply
```

### Run the project

Run all apps/services:

```bash
yarn dev
```

Or run specific apps:

```bash
yarn workspace api dev      # API (NestJS) - backend
yarn workspace app dev      # Frontend app (Vite) - main platform
yarn workspace web dev      # Next.js web app - landing page
yarn workspace docs dev     # Docs app
```
