/*
  Warnings:

  - Added the required column `projectId` to the `approvals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `comments` table without a default value. This is not possible if the table is not empty.

*/

-- Etapa 1: Adicionar coluna projectId como opcional temporariamente
ALTER TABLE "comments" ADD COLUMN "projectId" TEXT;
ALTER TABLE "approvals" ADD COLUMN "projectId" TEXT;

-- Etapa 2: Preencher projectId para Comments existentes
-- Se entityType = PROJECT, projectId = entityId
UPDATE "comments" 
SET "projectId" = "entityId"
WHERE "entityType" = 'PROJECT' AND "projectId" IS NULL;

-- Se entityType = STAGE, buscar projectId da stage
UPDATE "comments" c
SET "projectId" = s."projectId"
FROM "stages" s
WHERE c."entityType" = 'STAGE' 
  AND c."entityId" = s."id" 
  AND c."projectId" IS NULL;

-- Se entityType = ACTIVITY, buscar projectId via activity -> stage -> project
UPDATE "comments" c
SET "projectId" = s."projectId"
FROM "activities" a
JOIN "stages" s ON a."stageId" = s."id"
WHERE c."entityType" = 'ACTIVITY' 
  AND c."entityId" = a."id" 
  AND c."projectId" IS NULL;

-- Etapa 3: Preencher projectId para Approvals existentes
-- Se entityType = STAGE, buscar projectId da stage
UPDATE "approvals" a
SET "projectId" = s."projectId"
FROM "stages" s
WHERE a."entityType" = 'STAGE' 
  AND a."entityId" = s."id" 
  AND a."projectId" IS NULL;

-- Etapa 4: Tornar projectId obrigatório
ALTER TABLE "comments" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "approvals" ALTER COLUMN "projectId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "approvals_projectId_idx" ON "approvals"("projectId");

-- CreateIndex
CREATE INDEX "comments_projectId_idx" ON "comments"("projectId");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
