-- CreateTable
CREATE TABLE "proposal_artifacts" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_artifacts_proposalId_idx" ON "proposal_artifacts"("proposalId");

-- AddForeignKey
ALTER TABLE "proposal_artifacts" ADD CONSTRAINT "proposal_artifacts_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_artifacts" ADD CONSTRAINT "proposal_artifacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
