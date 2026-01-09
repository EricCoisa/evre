-- CreateTable
CREATE TABLE "client_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_logs_companyId_idx" ON "client_logs"("companyId");

-- CreateIndex
CREATE INDEX "client_logs_projectId_idx" ON "client_logs"("projectId");

-- CreateIndex
CREATE INDEX "client_logs_environment_idx" ON "client_logs"("environment");

-- AddForeignKey
ALTER TABLE "client_logs" ADD CONSTRAINT "client_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_logs" ADD CONSTRAINT "client_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
