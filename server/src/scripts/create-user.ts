import "dotenv/config";

import bcrypt from "bcryptjs";
import pg from "pg";
import readline from "node:readline/promises";

import {
  stdin as input,
  stdout as output,
} from "node:process";


const { Pool } = pg;


const migrationDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL;


if(!migrationDatabaseUrl) {

  throw new Error(
    "MIGRATION_DATABASE_URL is required",
  );

}


const pool = new Pool({
  connectionString:migrationDatabaseUrl,
});


const rl =
  readline.createInterface({
    input,
    output,
  });


try {

  const username =
    (
      await rl.question(
        "Username: ",
      )
    ).trim();


  const password =
    await rl.question(
      "Password: ",
    );


  if(
    !username ||
    !password
  ) {

    throw new Error(
      "Username and password are required",
    );

  }


  if(
    username.length > 100 ||
    password.length > 200
  ) {

    throw new Error(
      "Username or password is too long",
    );

  }


  const hash =
    await bcrypt.hash(
      password,
      12,
    );


  const client =
    await pool.connect();


  try {

    await client.query(
      "SET ROLE llg_owner",
    );


    await client.query(
      `
        INSERT INTO users(
          username,
          password_hash
        )
        VALUES($1, $2)
      `,
      [
        username,
        hash,
      ],
    );


    await client.query(
      "RESET ROLE",
    );


    console.log(
      "User created",
    );


  } finally {

    client.release();

  }


} finally {

  rl.close();

  await pool.end();

}
