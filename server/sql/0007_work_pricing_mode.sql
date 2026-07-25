ALTER TABLE works
ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'per_tooth';

ALTER TABLE works
ADD CONSTRAINT works_pricing_mode_check
CHECK (
  pricing_mode IN (
    'per_tooth',
    'fixed_total'
  )
);
