-- Contract step of the expand/contract migration started in 20260922020000_shared_lists.
-- Nothing deployed reads or writes "userId" anymore (see the previous release).

-- Backfill (hand-written): tasks created by an older version during a deploy window may have
-- their creator only in the old column. Copy it over before dropping.
UPDATE "Task" SET "createdById" = "userId" WHERE "createdById" IS NULL AND "userId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_userId_fkey";

-- DropIndex
DROP INDEX "Task_userId_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "userId";

