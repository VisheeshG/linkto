-- Backfill missing or invalid updated_at (null parses as epoch 0 in clients).

UPDATE public.projects
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL
   OR updated_at < '2000-01-01'::timestamptz;

UPDATE public.links
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL
   OR updated_at < '2000-01-01'::timestamptz;

UPDATE public.brands
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL
   OR updated_at < '2000-01-01'::timestamptz;
