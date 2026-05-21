-- Shopio Postgres init script
-- Enables required extensions on database creation (per `38-deployment-guide.md §7.1`)
-- Requires `pgvector/pgvector:pg17` image (per docker-compose.yml).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Note: `uuidv7()` function (per `03 §`) requires Postgres 17 native support OR
-- a custom function. We'll add the function in the first Drizzle migration
-- (per `packages/db` Fáze 1 wave 1).
