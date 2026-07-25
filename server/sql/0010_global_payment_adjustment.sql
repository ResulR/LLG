ALTER TABLE payments
ADD COLUMN adjustment_amount NUMERIC(14,2)
NOT NULL DEFAULT 0;

ALTER TABLE payments
ADD CONSTRAINT payments_adjustment_amount_check
CHECK (
  adjustment_amount >= -999999999999.99
  AND adjustment_amount <= 999999999999.99
);

UPDATE payments
SET
  adjustment_amount = discount_amount,
  discount_amount = 0
WHERE payment_type = 'global'
  AND discount_amount <> 0;
