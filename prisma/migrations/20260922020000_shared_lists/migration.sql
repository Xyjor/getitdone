-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('EDITOR', 'VIEWER');

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_userId_fkey";

-- DropIndex
DROP INDEX "Task_userId_idx";

-- AlterTable (hand-written): RENAME instead of drop + add, so no task loses its creator.
-- The column becomes nullable because a creator's account can be deleted while their tasks
-- live on in a list someone else owns.
ALTER TABLE "Task" RENAME COLUMN "userId" TO "createdById";
ALTER TABLE "Task" ALTER COLUMN "createdById" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ListMember" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListInvite" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListMember_userId_idx" ON "ListMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ListMember_listId_userId_key" ON "ListMember"("listId", "userId");

-- CreateIndex
CREATE INDEX "ListInvite_email_idx" ON "ListInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ListInvite_listId_email_key" ON "ListInvite"("listId", "email");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- AddForeignKey
ALTER TABLE "ListMember" ADD CONSTRAINT "ListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListMember" ADD CONSTRAINT "ListMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListInvite" ADD CONSTRAINT "ListInvite_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListInvite" ADD CONSTRAINT "ListInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

