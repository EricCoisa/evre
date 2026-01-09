-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "activities_order_idx" ON "activities"("order");
