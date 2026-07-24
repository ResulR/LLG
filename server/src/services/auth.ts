import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const jwtSecret: string = JWT_SECRET;

export async function verifyUser(
  username: string,
  password: string,
) {
  const result = await pool.query(
    `
      SELECT id, username, password_hash
      FROM users
      WHERE username = $1
        AND active = true
    `,
    [username],
  );

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(
    password,
    user.password_hash,
  );

  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
  };
}

export function createToken(userId: number) {
  return jwt.sign(
    { userId },
    jwtSecret,
    { expiresIn: "8h" },
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, jwtSecret);
}
