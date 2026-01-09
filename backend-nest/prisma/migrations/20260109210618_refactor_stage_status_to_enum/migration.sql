/*
  Warnings:

  - The `status` column on the `stages` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('TODO', 'DOING', 'DONE');

-- AlterTable
ALTER TABLE "stages" DROP COLUMN "status",
ADD COLUMN     "status" "StageStatus" NOT NULL DEFAULT 'TODO';

-- CreateIndex
CREATE INDEX "stages_status_idx" ON "stages"("status");
