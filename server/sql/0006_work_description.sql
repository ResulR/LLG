ALTER TABLE works
ADD COLUMN description TEXT;

ALTER TABLE works
ADD CONSTRAINT works_description_length_check
CHECK (
  description IS NULL
  OR char_length(description) <= 2000
);
