CREATE TABLE doctors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE doctor_patients (
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  patient_id BIGINT NOT NULL REFERENCES patients(id),
  PRIMARY KEY (doctor_id, patient_id)
);

CREATE TABLE materials (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE colors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE work_counters (
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doctor_id, year, month)
);

CREATE TABLE works (
  id BIGSERIAL PRIMARY KEY,

  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  patient_id BIGINT NOT NULL REFERENCES patients(id),

  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  monthly_number INTEGER NOT NULL,

  work_date DATE NOT NULL DEFAULT CURRENT_DATE,

  material_id BIGINT REFERENCES materials(id),
  color_id BIGINT REFERENCES colors(id),

  is_repeat BOOLEAN NOT NULL DEFAULT false,

  price_per_tooth NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'active',

  CONSTRAINT works_price_check
    CHECK (price_per_tooth >= 0 AND total_amount >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT works_status_check
    CHECK (status IN ('active', 'cancelled')),

  CONSTRAINT works_month_check
    CHECK (month BETWEEN 1 AND 12),

  CONSTRAINT works_unique_number
    UNIQUE (doctor_id, year, month, monthly_number)
);

CREATE TABLE work_teeth (
  id BIGSERIAL PRIMARY KEY,
  work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  tooth_number INTEGER NOT NULL,

  CONSTRAINT work_teeth_unique
    UNIQUE (work_id, tooth_number)
);

CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,

  doctor_id BIGINT NOT NULL REFERENCES doctors(id),

  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),

  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
