GRANT
  SELECT,
  INSERT,
  UPDATE,
  DELETE
ON TABLE public.colors
TO llg_app;

GRANT
  USAGE,
  SELECT
ON SEQUENCE public.colors_id_seq
TO llg_app;
