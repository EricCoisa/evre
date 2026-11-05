-- CreateEnum
CREATE TYPE "ProjectCommentEntityType" AS ENUM ('PROJECT', 'MILESTONE', 'TASK');

-- CreateEnum
CREATE TYPE "MilestoneApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectInfoRequestStatus" AS ENUM ('PENDING', 'ANSWERED', 'EXPIRED');

-- DropIndex
DROP INDEX "invites_email_key";

-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "scopeRole" "MembershipScopeRole";

-- CreateTable
CREATE TABLE "project_comments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityType" "ProjectCommentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_approvals" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "status" "MilestoneApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "respondedById" TEXT,
    "responseNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "milestone_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_info_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectInfoRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "answeredById" TEXT,
    "encryptedValue" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_info_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_comments_projectId_entityType_entityId_idx" ON "project_comments"("projectId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "milestone_approvals_milestoneId_idx" ON "milestone_approvals"("milestoneId");

-- CreateIndex
CREATE INDEX "project_info_requests_projectId_idx" ON "project_info_requests"("projectId");

-- CreateIndex (compound unique for invite per company)
CREATE UNIQUE INDEX "invites_email_companyId_key" ON "invites"("email", "companyId");

-- Partial unique index: system invites (no company) are unique by email alone.
-- PostgreSQL treats NULL != NULL in unique indexes, so the compound unique above
-- would allow duplicate system invites. This partial index closes that gap.
CREATE UNIQUE INDEX "invites_email_system_unique" ON "invites"("email") WHERE "companyId" IS NULL;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_approvals" ADD CONSTRAINT "milestone_approvals_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_approvals" ADD CONSTRAINT "milestone_approvals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_approvals" ADD CONSTRAINT "milestone_approvals_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_info_requests" ADD CONSTRAINT "project_info_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_info_requests" ADD CONSTRAINT "project_info_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_info_requests" ADD CONSTRAINT "project_info_requests_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
