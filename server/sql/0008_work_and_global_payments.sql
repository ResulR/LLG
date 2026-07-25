ALTER TABLE works
ADD COLUMN original_total_amount NUMERIC(10,2);

UPDATE works
SET original_total_amount = total_amount
WHERE original_total_amount IS NULL;

ALTER TABLE works
ALTER COLUMN original_total_amount SET NOT NULL;

ALTER TABLE works
ALTER COLUMN original_total_amount SET DEFAULT 0;


ALTER TABLE works
ADD COLUMN discount_total NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE works
ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';

ALTER TABLE works
ADD CONSTRAINT works_discount_total_check
CHECK (
  discount_total >= 0
  AND discount_total <= original_total_amount
);

ALTER TABLE works
ADD CONSTRAINT works_payment_status_check
CHECK (
  payment_status IN (
    'unpaid',
    'partial',
    'paid',
    'closed_global'
  )
);


CREATE TABLE doctor_settlements (
  id BIGSERIAL PRIMARY KEY,

  doctor_id BIGINT NOT NULL
    REFERENCES doctors(id)
    ON DELETE RESTRICT,

  settlement_date DATE NOT NULL
    DEFAULT CURRENT_DATE,

  works_total NUMERIC(10,2) NOT NULL,

  note TEXT,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  CONSTRAINT doctor_settlements_total_check
    CHECK (works_total > 0),

  CONSTRAINT doctor_settlements_note_length_check
    CHECK (
      note IS NULL
      OR CHAR_LENGTH(note) <= 500
    )
);


CREATE TABLE doctor_settlement_works (
  settlement_id BIGINT NOT NULL
    REFERENCES doctor_settlements(id)
    ON DELETE CASCADE,

  work_id BIGINT NOT NULL
    REFERENCES works(id)
    ON DELETE RESTRICT,

  amount_due NUMERIC(10,2) NOT NULL,

  PRIMARY KEY (
    settlement_id,
    work_id
  ),

  CONSTRAINT doctor_settlement_works_unique_work
    UNIQUE(work_id),

  CONSTRAINT doctor_settlement_works_amount_check
    CHECK (amount_due > 0)
);


ALTER TABLE payments
ADD COLUMN work_id BIGINT
  REFERENCES works(id)
  ON DELETE RESTRICT;

ALTER TABLE payments
ADD COLUMN settlement_id BIGINT
  REFERENCES doctor_settlements(id)
  ON DELETE SET NULL;

ALTER TABLE payments
ADD COLUMN payment_type TEXT NOT NULL
  DEFAULT 'legacy_global';

ALTER TABLE payments
ADD COLUMN discount_amount NUMERIC(10,2)
  NOT NULL DEFAULT 0;

ALTER TABLE payments
ADD CONSTRAINT payments_type_check
CHECK (
  payment_type IN (
    'individual',
    'global',
    'legacy_global'
  )
);

ALTER TABLE payments
ADD CONSTRAINT payments_discount_check
CHECK (discount_amount >= 0);


CREATE INDEX payments_work_id_idx
ON payments(work_id);

CREATE INDEX payments_doctor_type_idx
ON payments(
  doctor_id,
  payment_type,
  payment_date
);

CREATE INDEX payments_settlement_id_idx
ON payments(settlement_id);

CREATE INDEX doctor_settlements_doctor_date_idx
ON doctor_settlements(
  doctor_id,
  settlement_date
);

CREATE INDEX doctor_settlement_works_work_idx
ON doctor_settlement_works(work_id);


GRANT SELECT, INSERT, UPDATE, DELETE
ON doctor_settlements
TO llg_app;

GRANT SELECT, INSERT, UPDATE, DELETE
ON doctor_settlement_works
TO llg_app;

GRANT USAGE, SELECT
ON SEQUENCE doctor_settlements_id_seq
TO llg_app;
