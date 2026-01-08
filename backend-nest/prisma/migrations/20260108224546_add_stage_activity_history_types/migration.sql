-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProjectHistoryType" ADD VALUE 'STAGE_CREATED';
ALTER TYPE "ProjectHistoryType" ADD VALUE 'STAGE_UPDATED';
ALTER TYPE "ProjectHistoryType" ADD VALUE 'STAGE_DELETED';
ALTER TYPE "ProjectHistoryType" ADD VALUE 'STAGE_REORDERED';
ALTER TYPE "ProjectHistoryType" ADD VALUE 'ACTIVITY_CREATED';
ALTER TYPE "ProjectHistoryType" ADD VALUE 'ACTIVITY_UPDATED';
ALTER TYPE "ProjectHistoryType" ADD VALUE 'ACTIVITY_DELETED';
ALTER TYPE "ProjectHistoryType" ADD VALUE 'ACTIVITY_MOVED';
