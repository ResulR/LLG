import "dotenv/config";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { pool } from "../db/pool.js";

const rl = readline.createInterface({
  input,
  output,
});

const username = await rl.question("Username: ");
const password = await rl.question("Password: ");

rl.close();

const hash = await bcrypt.hash(password, 12);

await pool.query(
  `
    INSERT INTO users(username, password_hash)
    VALUES($1, $2)
  `,
  [username, hash],
);

console.log("User created");

await pool.end();
