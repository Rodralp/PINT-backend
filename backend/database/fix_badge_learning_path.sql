-- ============================================================
-- ONE-OFF FIX: move badge -> learning_path relation to join table
-- Safe to run once on an existing database.
-- ============================================================

BEGIN;

-- 1) Ensure join table exists (PK enforces uniqueness)
CREATE TABLE IF NOT EXISTS b_pertence_lp (
    nlpath INTEGER NOT NULL REFERENCES learning_path(nlpath),
    nbadge INTEGER NOT NULL REFERENCES badge(nbadge),
    PRIMARY KEY (nlpath, nbadge)
);

-- 2) Copy existing relations from badge.nlpath (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'badge'
          AND column_name = 'nlpath'
    ) THEN
        INSERT INTO b_pertence_lp (nlpath, nbadge)
        SELECT DISTINCT b.nlpath, b.nbadge
        FROM badge b
        WHERE b.nlpath IS NOT NULL
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 3) Drop FK from badge to learning_path (constraint name may vary)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE t.relname = 'badge'
      AND c.contype = 'f'
      AND a.attname = 'nlpath'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE badge DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- 4) Drop column from badge
ALTER TABLE badge
    DROP COLUMN IF EXISTS nlpath;

COMMIT;
