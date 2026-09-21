import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createSampleData } from "../src/lib/sample-data";

// Creates (or resets) a local test account:  demo@getitdone.dev / password123

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EMAIL = "demo@getitdone.dev";
const PASSWORD = "password123";

async function main() {
  await prisma.user.deleteMany({ where: { email: EMAIL } });

  const user = await prisma.user.create({
    data: {
      name: "Alex Rivera",
      email: EMAIL,
      passwordHash: await bcrypt.hash(PASSWORD, 12),
    },
  });
  await createSampleData(prisma, user.id);

  console.log(`Seeded ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
