CREATE TABLE work_price_changes (
  id BIGSERIAL PRIMARY KEY,

  work_id BIGINT NOT NULL
    REFERENCES works(id)
    ON DELETE RESTRICT,

  previous_total_amount NUMERIC(10,2) NOT NULL,

  new_total_amount NUMERIC(10,2) NOT NULL,

  change_date DATE NOT NULL
    DEFAULT CURRENT_DATE,

  note TEXT,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  CONSTRAINT work_price_changes_previous_check
    CHECK (previous_total_amount >= 0),

  CONSTRAINT work_price_changes_new_check
    CHECK (new_total_amount >= 0),

  CONSTRAINT work_price_changes_difference_check
    CHECK (
      previous_total_amount
      <> new_total_amount
    ),

  CONSTRAINT work_price_changes_note_length_check
    CHECK (
      note IS NULL
      OR CHAR_LENGTH(note) <= 500
    )
);

CREATE INDEX work_price_changes_work_date_idx
ON work_price_changes(
  work_id,
  change_date DESC,
  id DESC
);

GRANT SELECT, INSERT, UPDATE, DELETE
ON work_price_changes
TO llg_app;

GRANT USAGE, SELECT
ON SEQUENCE work_price_changes_id_seq
TO llg_app;
