import "dotenv/config";
import { Client } from "pg";

/** Removes the accounts created by the end-to-end tests (their lists and tasks cascade). */
export default async function globalTeardown() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`DELETE FROM "User" WHERE email LIKE '%@test.getitdone.local'`);
  await client.end();
}
