-- Add the optional degree type used by the structure manager and registration forms.
-- IF NOT EXISTS: the init migration already created "type" for legacy rows, so a
-- plain ADD COLUMN fails on databases migrated from scratch.
ALTER TABLE "degree_sought" ADD COLUMN IF NOT EXISTS "type" TEXT;
