-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "LogModule" ADD VALUE 'CONTRACT_DOCUMENT';

-- CreateTable
CREATE TABLE "contract_documents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "proposalId" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "contentSchemaVersion" TEXT NOT NULL DEFAULT 'v1',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_documents_projectId_idx" ON "contract_documents"("projectId");

-- CreateIndex
CREATE INDEX "contract_documents_proposalId_idx" ON "contract_documents"("proposalId");

-- CreateIndex
CREATE INDEX "contract_documents_status_idx" ON "contract_documents"("status");

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
