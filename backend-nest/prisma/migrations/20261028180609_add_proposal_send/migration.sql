-- CreateTable
CREATE TABLE "proposal_sends" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "toPhone" TEXT,
    "toEmail" TEXT,
    "succeeded" BOOLEAN NOT NULL,
    "detail" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_sends_versionId_idx" ON "proposal_sends"("versionId");

-- AddForeignKey
ALTER TABLE "proposal_sends" ADD CONSTRAINT "proposal_sends_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_sends" ADD CONSTRAINT "proposal_sends_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
