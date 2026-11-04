-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('FILE', 'FOLDER');

-- AlterEnum
ALTER TYPE "LogModule" ADD VALUE 'ARTIFACT';

-- DropForeignKey
ALTER TABLE "proposal_artifacts" DROP CONSTRAINT "proposal_artifacts_createdById_fkey";

-- DropForeignKey
ALTER TABLE "proposal_artifacts" DROP CONSTRAINT "proposal_artifacts_proposalId_fkey";

-- DropTable
DROP TABLE "proposal_artifacts";

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "entryFileName" TEXT,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT,
    "files" JSONB NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publicToken" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "artifacts_publicToken_key" ON "artifacts"("publicToken");

-- CreateIndex
CREATE INDEX "artifacts_archivedAt_idx" ON "artifacts"("archivedAt");

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

