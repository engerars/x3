# x3 Architecture

## Layers

1. `index.html`
2. `assets/css/app.css`
3. `assets/js/auto-retry.js`
4. `assets/js/app.js` (ESM entry)
5. `assets/js/modules/`

## Core Modules

- `database-service.js`: IndexedDB schema, data migration, utility helpers.
- `main-app.js`: Vue root app and UI runtime.
- `repositories/contract.repository.js`: contract persistence flows (save, single/multi delete cascade, excel merge).
- `repositories/cpc.repository.js`: CPC persistence flows (save with relations, CPC delete cascade).
- `repositories/installment.repository.js`: installment persistence flows (edit installment, save SWAP installment).
- `repositories/bond.repository.js`: bond persistence flows (save, renew, delete single/multi).
- `repositories/vendor.repository.js`: vendor/project persistence flows (save vendor, delete vendor/project, vendor import).
- `repositories/category.repository.js`: report-category persistence flows (upload upsert, modal save, delete, initial seed).
- `repositories/cpc-detail.repository.js`: CPC detail-row persistence primitives (add/reorder, put, bulkPut, delete).
- `repositories/import.repository.js`: transaction-level project dataset import (delete old project graph + upsert new graph in one atomic transaction).
- `repositories/maintenance.repository.js`: maintenance utilities for atomic bulk deletion by table/id map.

Current direction:
- `main-app.js` acts as orchestration/UI layer and delegates persistence to repository modules instead of direct `databaseService.db.*` access.
- `schemas/entity.schemas.js`: input schema validation before DB writes.

## Persistence Utilities

- `databaseService.upsertBatch(tableName, rows)`: upsert by `id` without clearing full table.
- `databaseService.saveTables(tablesData)`: save selected table sets, reducing full-replace operations.

## Domain Modules

- `domain/vendor.module.js`: vendor template/export and vendor import parsing.
- `domain/contract.module.js`: contract column visibility state helpers.
- `domain/installment.module.js`: installment expand/collapse behavior.
- `domain/report.module.js`: accounting workbook parser and status badge mapping.

## Config

- `config/app.config.js`: shared sheet names and template headers.
