-- Custom uuidv7() implementation for Postgres 17
-- Postgres 17 doesn't ship uuidv7() natively (planned for 18).
-- Per `03-data-models-master.md` — time-sortable UUIDs preferred.
--
-- RFC 9562 compliant uuidv7.
-- Run BEFORE first Drizzle migration via `pnpm db:migrate` script.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid AS $$
DECLARE
  ts_ms bigint;
  uuid_bytes bytea;
BEGIN
  -- Current Unix timestamp in milliseconds
  ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;

  -- Start with 16 random bytes
  uuid_bytes := gen_random_bytes(16);

  -- Overlay timestamp (first 6 bytes, big-endian)
  uuid_bytes := set_byte(uuid_bytes, 0, ((ts_ms >> 40) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 1, ((ts_ms >> 32) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 2, ((ts_ms >> 24) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 3, ((ts_ms >> 16) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 4, ((ts_ms >>  8) & 255)::int);
  uuid_bytes := set_byte(uuid_bytes, 5, ( ts_ms        & 255)::int);

  -- Set version 7 (0111) in upper 4 bits of byte 6
  uuid_bytes := set_byte(uuid_bytes, 6,
    ((get_byte(uuid_bytes, 6) & 15) | 112)::int  -- (& 0x0F) | 0x70
  );

  -- Set variant (10) in upper 2 bits of byte 8
  uuid_bytes := set_byte(uuid_bytes, 8,
    ((get_byte(uuid_bytes, 8) & 63) | 128)::int  -- (& 0x3F) | 0x80
  );

  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE PARALLEL SAFE;

COMMENT ON FUNCTION uuidv7() IS 'RFC 9562 UUIDv7 — time-sortable. Replace with native when Postgres 18 lands.';

-- Sanity test
DO $$
DECLARE
  test_id uuid;
BEGIN
  test_id := uuidv7();
  RAISE NOTICE 'uuidv7() installed. Sample: %', test_id;
END $$;
