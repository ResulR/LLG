GRANT
  SELECT,
  INSERT,
  UPDATE,
  DELETE
ON TABLE materials
TO llg_app;

GRANT
  USAGE,
  SELECT
ON SEQUENCE materials_id_seq
TO llg_app;
