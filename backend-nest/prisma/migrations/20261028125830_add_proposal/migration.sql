-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'LOST');

-- CreateEnum
CREATE TYPE "ProposalRecurrence" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "LogModule" ADD VALUE 'PROPOSAL';

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "lostReason" TEXT,
    "layout" JSONB,
    "totalCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "recurrence" "ProposalRecurrence" NOT NULL DEFAULT 'ONE_TIME',
    "termDays" INTEGER,
    "validUntil" TIMESTAMP(3),
    "includedItems" TEXT[],
    "optionalItems" TEXT[],
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_versions" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "layout" JSONB NOT NULL,
    "totalCents" INTEGER,
    "currency" TEXT NOT NULL,
    "recurrence" "ProposalRecurrence" NOT NULL,
    "termDays" INTEGER,
    "validUntil" TIMESTAMP(3),
    "includedItems" TEXT[],
    "optionalItems" TEXT[],
    "publicToken" TEXT,
    "publishedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposals_companyId_idx" ON "proposals"("companyId");

-- CreateIndex
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_publicToken_key" ON "proposal_versions"("publicToken");

-- CreateIndex
CREATE INDEX "proposal_versions_publicToken_idx" ON "proposal_versions"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_proposalId_version_key" ON "proposal_versions"("proposalId", "version");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
