CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT now(),

  last_activity_at TIMESTAMPTZ NOT NULL
    DEFAULT now(),

  absolute_expires_at TIMESTAMPTZ NOT NULL,

  revoked_at TIMESTAMPTZ,

  CONSTRAINT user_sessions_expiration_check
    CHECK (absolute_expires_at > created_at)
);

CREATE INDEX user_sessions_user_id_idx
  ON user_sessions(user_id);

CREATE INDEX user_sessions_active_lookup_idx
  ON user_sessions(id, user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX user_sessions_expiration_idx
  ON user_sessions(absolute_expires_at);

GRANT SELECT, INSERT, UPDATE
ON TABLE user_sessions
TO llg_app;
