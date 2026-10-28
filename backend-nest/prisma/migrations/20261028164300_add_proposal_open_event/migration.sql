-- CreateTable
CREATE TABLE "proposal_open_events" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_open_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_open_events_versionId_idx" ON "proposal_open_events"("versionId");
