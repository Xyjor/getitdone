import "dotenv/config";
import { Client } from "pg";

/** Removes the accounts created by the end-to-end tests, with their lists and tasks. */
export default async function globalTeardown() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  // Their lists first, then the users (deleting users that share lists in one statement would
  // make Postgres both cascade and null the same task rows).
  await client.query(
    `DELETE FROM "List" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test.getitdone.local')`,
  );
  await client.query(`DELETE FROM "User" WHERE email LIKE '%@test.getitdone.local'`);
  await client.end();
}
