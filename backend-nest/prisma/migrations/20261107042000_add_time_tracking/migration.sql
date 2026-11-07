-- AlterEnum
ALTER TYPE "LogModule" ADD VALUE IF NOT EXISTS 'TIME_TRACKING';

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('TIMER', 'MANUAL');

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'TIMER',
    "entityType" TEXT,
    "entityId" TEXT,
    "entityTitle" TEXT,
    "projectId" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "editedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_userId_endTime_idx" ON "time_entries"("userId", "endTime");

-- CreateIndex
CREATE INDEX "time_entries_projectId_idx" ON "time_entries"("projectId");

-- CreateIndex
CREATE INDEX "time_entries_entityType_entityId_idx" ON "time_entries"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
