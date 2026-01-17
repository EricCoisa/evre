/*
  Warnings:

  - A unique constraint covering the columns `[approvalRequestId]` on the table `approvals` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `approvalRequestId` to the `approvals` table without a default value. This is not possible if the table is not empty.

*/

-- Remove existing approvals (desenvolvimento - dados de teste)
DELETE FROM "approvals";

-- AlterEnum
ALTER TYPE "ApprovalStatus" ADD VALUE 'APPROVED_WITH_REMARKS';

-- AlterTable
ALTER TABLE "approvals" ADD COLUMN     "approvalRequestId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "approvals_approvalRequestId_key" ON "approvals"("approvalRequestId");

-- CreateIndex
CREATE INDEX "approvals_approvalRequestId_idx" ON "approvals"("approvalRequestId");

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
