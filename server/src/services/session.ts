import crypto from "node:crypto";

import { pool } from "../db/pool.js";


export const SESSION_IDLE_MS =
  5 * 60 * 1000;

export const SESSION_ABSOLUTE_MS =
  60 * 60 * 1000;

const SESSION_TOUCH_INTERVAL_MS =
  15 * 1000;


export type SessionRecord = {
  id:string;
  userId:string;
  createdAt:string;
  lastActivityAt:string;
  absoluteExpiresAt:string;
  serverNow:string;
};


type SessionRow = {
  id:string;
  user_id:string;
  created_at:Date;
  last_activity_at:Date;
  absolute_expires_at:Date;
  revoked_at:Date | null;
  server_now:Date;
};


function serializeSession(
  row:SessionRow,
):SessionRecord {

  return {
    id:row.id,
    userId:String(row.user_id),
    createdAt:row.created_at.toISOString(),
    lastActivityAt:
      row.last_activity_at.toISOString(),
    absoluteExpiresAt:
      row.absolute_expires_at.toISOString(),
    serverNow:row.server_now.toISOString(),
  };

}


export async function createSession(
  userId:string,
):Promise<SessionRecord> {

  const sessionId =
    crypto.randomUUID();


  const result =
    await pool.query<SessionRow>(
      `
        INSERT INTO user_sessions(
          id,
          user_id,
          created_at,
          last_activity_at,
          absolute_expires_at
        )
        VALUES(
          $1,
          $2,
          now(),
          now(),
          now() + interval '1 hour'
        )
        RETURNING
          id,
          user_id,
          created_at,
          last_activity_at,
          absolute_expires_at,
          revoked_at,
          now() AS server_now
      `,
      [
        sessionId,
        userId,
      ],
    );


  return serializeSession(
    result.rows[0],
  );

}


export async function validateSession(
  sessionId:string,
  userId:string,
  touchActivity:boolean,
):Promise<SessionRecord | null> {

  const result =
    await pool.query<SessionRow>(
      `
        SELECT
          id,
          user_id,
          created_at,
          last_activity_at,
          absolute_expires_at,
          revoked_at,
          now() AS server_now
        FROM user_sessions
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [
        sessionId,
        userId,
      ],
    );


  const session =
    result.rows[0];


  if(!session) {
    return null;
  }


  const serverNow =
    session.server_now.getTime();

  const absoluteExpiration =
    session.absolute_expires_at.getTime();

  const idleExpiration =
    session.last_activity_at.getTime()
      + SESSION_IDLE_MS;


  if(
    session.revoked_at ||
    serverNow >= absoluteExpiration ||
    serverNow >= idleExpiration
  ) {

    if(!session.revoked_at) {

      await pool.query(
        `
          UPDATE user_sessions
          SET revoked_at = COALESCE(
            revoked_at,
            now()
          )
          WHERE id = $1
            AND user_id = $2
        `,
        [
          sessionId,
          userId,
        ],
      );

    }


    return null;

  }


  if(
    touchActivity &&
    (
      serverNow -
      session.last_activity_at.getTime()
    ) >= SESSION_TOUCH_INTERVAL_MS
  ) {

    const touched =
      await pool.query<SessionRow>(
        `
          UPDATE user_sessions
          SET last_activity_at = now()
          WHERE id = $1
            AND user_id = $2
            AND revoked_at IS NULL
            AND absolute_expires_at > now()
            AND last_activity_at >
              now() - interval '5 minutes'
          RETURNING
            id,
            user_id,
            created_at,
            last_activity_at,
            absolute_expires_at,
            revoked_at,
            now() AS server_now
        `,
        [
          sessionId,
          userId,
        ],
      );


    if(!touched.rows[0]) {
      return null;
    }


    return serializeSession(
      touched.rows[0],
    );

  }


  return serializeSession(
    session,
  );

}


export async function revokeSession(
  sessionId:string,
  userId:string,
):Promise<void> {

  await pool.query(
    `
      UPDATE user_sessions
      SET revoked_at = COALESCE(
        revoked_at,
        now()
      )
      WHERE id = $1
        AND user_id = $2
    `,
    [
      sessionId,
      userId,
    ],
  );

}
