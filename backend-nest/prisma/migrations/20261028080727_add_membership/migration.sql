-- CreateEnum
CREATE TYPE "MembershipScopeRole" AS ENUM ('OWNER', 'COLLABORATOR', 'VIEWER');

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "projectId" TEXT,
    "scopeRole" "MembershipScopeRole" NOT NULL DEFAULT 'COLLABORATOR',
    "canSeeCommercials" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memberships_userId_idx" ON "memberships"("userId");

-- CreateIndex
CREATE INDEX "memberships_companyId_idx" ON "memberships"("companyId");

-- CreateIndex
CREATE INDEX "memberships_projectId_idx" ON "memberships"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_companyId_projectId_key" ON "memberships"("userId", "companyId", "projectId");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
