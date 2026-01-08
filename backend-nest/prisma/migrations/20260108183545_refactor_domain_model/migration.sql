-- CreateEnum para novos tipos
CREATE TYPE "CommentEntityType" AS ENUM ('PROJECT', 'STAGE', 'ACTIVITY');
CREATE TYPE "ApprovalEntityType" AS ENUM ('STAGE');

-- Etapa 1: Adicionar novos campos em Comment com valores temporários
ALTER TABLE "comments" ADD COLUMN "entityType" "CommentEntityType" DEFAULT 'PROJECT';
ALTER TABLE "comments" ADD COLUMN "entityId" TEXT DEFAULT '';

-- Migrar dados existentes de Comment (projectId -> entityType/entityId)
UPDATE "comments" 
SET "entityType" = 'PROJECT', 
    "entityId" = "projectId"
WHERE "projectId" IS NOT NULL;

-- Tornar campos obrigatórios e remover defaults
ALTER TABLE "comments" ALTER COLUMN "entityType" DROP DEFAULT;
ALTER TABLE "comments" ALTER COLUMN "entityId" DROP DEFAULT;
ALTER TABLE "comments" ALTER COLUMN "entityType" SET NOT NULL;
ALTER TABLE "comments" ALTER COLUMN "entityId" SET NOT NULL;

-- Remover coluna antiga
ALTER TABLE "comments" DROP CONSTRAINT "comments_projectId_fkey";
ALTER TABLE "comments" DROP COLUMN "projectId";

-- Etapa 2: Adicionar novos campos em Approval com valores temporários
ALTER TABLE "approvals" ADD COLUMN "entityType" "ApprovalEntityType" DEFAULT 'STAGE';
ALTER TABLE "approvals" ADD COLUMN "entityId" TEXT DEFAULT '';

-- Migrar dados existentes de Approval (stageId -> entityType/entityId)
UPDATE "approvals" 
SET "entityType" = 'STAGE', 
    "entityId" = "stageId"
WHERE "stageId" IS NOT NULL;

-- Tornar campos obrigatórios e remover defaults
ALTER TABLE "approvals" ALTER COLUMN "entityType" DROP DEFAULT;
ALTER TABLE "approvals" ALTER COLUMN "entityId" DROP DEFAULT;
ALTER TABLE "approvals" ALTER COLUMN "entityType" SET NOT NULL;
ALTER TABLE "approvals" ALTER COLUMN "entityId" SET NOT NULL;

-- Remover coluna antiga
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_stageId_fkey";
ALTER TABLE "approvals" DROP COLUMN "stageId";

-- Etapa 3: Remover proposalId de Project
ALTER TABLE "projects" DROP COLUMN "proposalId";

-- Recriar índices
DROP INDEX IF EXISTS "comments_projectId_idx";
CREATE INDEX "comments_entityType_entityId_idx" ON "comments"("entityType", "entityId");

DROP INDEX IF EXISTS "approvals_stageId_idx";
CREATE INDEX "approvals_entityType_entityId_idx" ON "approvals"("entityType", "entityId");

DROP INDEX IF EXISTS "projects_proposalId_idx";
