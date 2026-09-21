import "dotenv/config";

process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters-long";
