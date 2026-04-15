# SaaS Migration for Large Datasets

## Overview
This document describes the strategy for migrating existing cinema datasets to the multi-tenant SaaS architecture without risking memory exhaustion (OOM) on the database server.

## The Problem
Standard `INSERT INTO ... SELECT * FROM ...` operations in PostgreSQL load the entire result set into memory before committing. For deployments with millions of showtimes, this can lead to:
- Database OOM killer terminating the process.
- Excessive WAL growth.
- Long-term table locking.

## The Solution: Batched Migration
Instead of a single monolithic transaction, we use a PL/pgSQL loop to move data in fixed-size chunks (batches).

### Technical Approach
1. **Chunking**: Use `LIMIT` and `OFFSET` (or primary key ranges for better performance) to process records.
2. **Idempotency**: Use `ON CONFLICT (id) DO NOTHING` to allow the script to be restarted without duplicating data.
3. **Transaction Control**: Each batch is processed in its own transaction scope to prevent bloating the undo logs.

### Expected Performance
- **Batch Size**: 10,000 records.
- **Target**: 10M records migrated in <<  1 hour.
- **Memory Impact**: Constant, regardless of total dataset size.

## Implementation Details
The implementation is provided in `scripts/migrate-existing-to-saas.sh`.
