# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TRABIX is a backend API for a granizado (frozen drink) sales management system. It handles inventory batches (lotes/tandas), retail and wholesale sales, vendor settlements (cuadres), equipment management, multi-level recruitment commissions, and notifications.

## Tech Stack

- **Runtime/Framework:** Node.js 20 LTS + NestJS 10 + TypeScript 5.1 (strict mode)
- **ORM/Database:** Prisma 5.8 + PostgreSQL 16
- **Cache/Queue:** Redis 7 + Bull
- **Auth:** JWT (access + refresh tokens) with Passport
- **CQRS:** @nestjs/cqrs for command/query separation
- **Events:** @nestjs/event-emitter + event store + outbox pattern
- **Validation:** class-validator + class-transformer + Joi (env validation)
- **API Docs:** Swagger at `/docs` (non-production only)
- **Testing:** Jest 29

## Common Commands

```bash
# Development
npm run start:dev              # Hot-reload dev server
npm run start:debug            # Debug mode (port 9229)

# Testing
npm run test                   # Unit tests
npm run test:watch             # Watch mode
npm run test:cov               # Coverage report (thresholds: 70% branches/functions, 75% lines/statements)
npm run test:e2e               # E2E tests (requires docker:test:up)

# Database
npm run prisma:generate        # Generate Prisma client
npm run prisma:migrate         # Run migrations (dev)
npm run prisma:migrate:prod    # Deploy migrations (production)
npm run prisma:seed            # Seed database
npm run prisma:studio          # Prisma Studio UI

# Docker
npm run docker:dev             # Dev stack (API + Postgres + Redis + Adminer + Redis Commander)
npm run docker:test:up         # Test environment
npm run docker:test:down       # Stop test environment

# Code quality
npm run lint                   # ESLint with auto-fix
npm run format                 # Prettier formatting
```

## Architecture

**Clean Architecture (Hexagonal) with CQRS in a Modular Monolith.**

```
src/
├── config/              # App configuration (database, redis, jwt, throttle, validation schema)
├── domain/              # Shared domain entities, value objects, domain services
├── application/         # Shared use cases (commands, queries, DTOs)
├── infrastructure/      # Technical implementations
│   ├── database/prisma/ # Prisma service & module
│   ├── cache/           # Redis caching service
│   ├── queue/           # Bull queue module
│   ├── events/          # Event store + outbox pattern
│   └── scheduler/       # Cron jobs (cleanup, auto-transitions, reminders)
├── presentation/http/   # Filters (exception handling), interceptors (logging, idempotency)
├── modules/             # Feature modules (bounded contexts) — see below
└── shared/              # Shared utilities
```

### Module Structure Convention

Each of the 13 feature modules follows this layout:

```
modules/<name>/
├── <name>.module.ts
├── application/
│   ├── commands/        # Write operations (Command + Handler)
│   ├── queries/         # Read operations (Query + Handler)
│   ├── dto/             # Request/response DTOs
│   └── events/          # Event handlers
├── domain/
│   ├── *.entity.ts
│   ├── *.repository.interface.ts   # Repository contracts
│   └── *.service.ts                # Domain services
├── infrastructure/
│   └── prisma-*.repository.ts      # Prisma repository implementations
└── controllers/
    └── *.controller.ts
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `auth` | JWT auth, guards, strategies, progressive lockout |
| `usuarios` | User management (ADMIN, VENDEDOR, RECLUTADOR roles) |
| `lotes` | Batch/lot management with investment calculations |
| `ventas` | Retail sales (PROMO, UNIDAD, SIN_LICOR, REGALO types) |
| `ventas-mayor` | Wholesale sales with stock source tracking |
| `cuadres` | Vendor settlement/reconciliation |
| `cuadres-mayor` | Wholesale settlements with recruitment commissions |
| `mini-cuadres` | Batch-level mini-settlements |
| `equipamiento` | Equipment deposits, monthly payments, damage tracking |
| `fondo-recompensas` | Rewards fund management |
| `notificaciones` | Multi-channel notifications (WebSocket, Push, WhatsApp) |
| `admin` | Dashboard, stock orders, system configuration |
| `health` | Health check endpoints |

## Database

Schema is in `prisma/schema.prisma` (~646 lines, 25+ tables). Key relationships:

- **Usuario** has self-referential recruitment hierarchy (reclutador → vendedores)
- **Lote → Tanda** (one-to-many): batches split into 2-3 sub-batches based on quantity (≤50 = 2, >50 = 3)
- **Tanda state machine:** INACTIVA → LIBERADA → EN_TRANSITO → EN_CASA → FINALIZADA
- **Venta → DetalleVenta** (one-to-many): sales with line items
- **CuadreMayor → GananciaReclutador**: multi-level recruitment commissions

Seeds are modular in `prisma/seeds/` (files 01-09), orchestrated by `prisma/seed.ts`.

## Code Patterns

**Dependency Injection:** Symbol-based injection tokens for repository interfaces (e.g., interface in domain layer, Prisma implementation in infrastructure layer, wired in module).

**CQRS:** Commands for writes, Queries for reads. Handlers registered in each module.

**Outbox Pattern:** Domain events are persisted transactionally via the outbox table, then polled and dispatched (5s interval, max 3 retries).

**Controllers:** Use `@Public()` decorator to bypass JWT auth. `@Roles()` for RBAC. Idempotency interceptor for critical write operations.

## TypeScript Path Aliases

```
@/*              → src/*
@domain/*        → src/domain/*
@application/*   → src/application/*
@infrastructure/* → src/infrastructure/*
@presentation/*  → src/presentation/*
@shared/*        → src/shared/*
@config/*        → src/config/*
@modules/*       → src/modules/*
```

## Code Style

- **Prettier:** Single quotes, trailing commas, 2-space indent, semicolons, 100-char line width, LF endings
- **ESLint:** TypeScript recommended + Prettier integration
- **Naming:** PascalCase for classes/interfaces/enums, camelCase for variables/functions, UPPER_SNAKE_CASE for env vars
- **File suffixes:** `.service.ts`, `.controller.ts`, `.module.ts`, `.entity.ts`, `.dto.ts`, `.repository.interface.ts`, `prisma-*.repository.ts`

## Business Rules

- Two business models: MODELO_60_40 (direct) and MODELO_50_50 (with recruiter)
- Investment split: 50% admin, 50% vendor
- Gift limit: 8 per lote
- Wholesale pricing tiers at 20, 50, 100 units
- Progressive lockout: 3 levels + permanent ban on repeated failed logins
- Cuadres trigger automatically based on configurable stock thresholds
- Equipment debt is deducted from settlements

## API

- **Base URL:** `/api/v1` (URI-based versioning)
- **Global pipes:** ValidationPipe (whitelist, transform)
- **Global guards:** ThrottleGuard, JwtAuthGuard (default), RolesGuard
- **Global interceptors:** LoggingInterceptor, IdempotencyInterceptor
- **Global filters:** DomainExceptionFilter, HttpExceptionFilter, AllExceptionsFilter

## Environment

Configuration validated via Joi schema in `src/config/validation.schema.ts`. Key variable categories: database (DATABASE_URL), Redis, JWT secrets/expiration, business prices (PRECIO_*, COSTO_*), percentages (PORCENTAJE_GANANCIA_*), throttle/rate-limit, and lockout levels. See `.env.example` or `SETUP_LOCAL.md` for the full list.
