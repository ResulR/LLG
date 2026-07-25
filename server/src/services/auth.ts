import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { pool } from "../db/pool.js";


const JWT_SECRET =
  process.env.JWT_SECRET;


if(!JWT_SECRET) {

  throw new Error(
    "JWT_SECRET is required",
  );

}


const jwtSecret:string =
  JWT_SECRET;


export type SessionTokenPayload = {
  userId:string;
  sessionId:string;
  iat?:number;
  exp?:number;
};


export async function verifyUser(
  username:string,
  password:string,
) {

  const result =
    await pool.query(
      `
        SELECT
          id,
          username,
          password_hash
        FROM users
        WHERE username = $1
          AND active = true
      `,
      [username],
    );


  const user =
    result.rows[0];


  if(!user) {
    return null;
  }


  const valid =
    await bcrypt.compare(
      password,
      user.password_hash,
    );


  if(!valid) {
    return null;
  }


  return {
    id:String(user.id),
    username:String(user.username),
  };

}


export function createToken(
  userId:string,
  sessionId:string,
) {

  return jwt.sign(
    {
      userId,
      sessionId,
    },
    jwtSecret,
    {
      expiresIn:"1h",
    },
  );

}


export function verifyToken(
  token:string,
):SessionTokenPayload {

  const payload =
    jwt.verify(
      token,
      jwtSecret,
    );


  if(
    typeof payload === "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.sessionId !== "string"
  ) {

    throw new Error(
      "Invalid session token payload",
    );

  }


  return {
    userId:payload.userId,
    sessionId:payload.sessionId,
    iat:payload.iat,
    exp:payload.exp,
  };

}
