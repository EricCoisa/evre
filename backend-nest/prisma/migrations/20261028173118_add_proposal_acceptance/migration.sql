-- CreateEnum
CREATE TYPE "ProposalAcceptanceSource" AS ENUM ('LINK', 'OFFLINE');

-- AlterTable
ALTER TABLE "proposal_versions" ADD COLUMN     "acceptanceAgent" TEXT,
ADD COLUMN     "acceptanceIp" TEXT,
ADD COLUMN     "acceptanceNote" TEXT,
ADD COLUMN     "acceptanceSource" "ProposalAcceptanceSource",
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedByEmail" TEXT,
ADD COLUMN     "acceptedByName" TEXT;
