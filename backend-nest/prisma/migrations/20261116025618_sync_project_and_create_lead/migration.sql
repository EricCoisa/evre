-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'VIEWED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LogModule" ADD VALUE 'LEAD';

-- AlterEnum
ALTER TYPE "MilestoneApprovalStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "ProjectInfoRequestStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "milestone_approvals" ADD COLUMN     "requestNote" TEXT;

-- AlterTable
ALTER TABLE "project_milestones" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "project_tasks" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "status" "ProjectTaskStatus" NOT NULL DEFAULT 'WAITING';

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "messagingContactId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "project_tasks_status_idx" ON "project_tasks"("status");

-- CreateIndex
CREATE INDEX "project_tasks_assigneeId_idx" ON "project_tasks"("assigneeId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_messagingContactId_fkey" FOREIGN KEY ("messagingContactId") REFERENCES "messaging_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
