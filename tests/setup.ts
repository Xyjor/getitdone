import "dotenv/config";

process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters-long";

process.env.CRON_SECRET ??= "test-cron-secret";
