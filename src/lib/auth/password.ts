import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// A valid hash of a random string. Comparing against it when a user doesn't exist
// keeps login timing the same for unknown emails, so attackers can't probe for accounts.
const DUMMY_HASH = "$2b$12$zopHtS26qyfN5WIsAxYKAuMU0urNtPYa5q4OG92rStkQjtTPDdVl6";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && hash != null;
}
