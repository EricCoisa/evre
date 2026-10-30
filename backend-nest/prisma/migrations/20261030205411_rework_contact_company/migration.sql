/*
  Warnings:

  - You are about to drop the `contacts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_companyId_fkey";

-- DropTable
DROP TABLE "contacts";

-- CreateTable
CREATE TABLE "company_contacts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "messagingContactId" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isDecisionMaker" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_contacts_companyId_idx" ON "company_contacts"("companyId");

-- CreateIndex
CREATE INDEX "company_contacts_messagingContactId_idx" ON "company_contacts"("messagingContactId");

-- CreateIndex
CREATE UNIQUE INDEX "company_contacts_companyId_messagingContactId_key" ON "company_contacts"("companyId", "messagingContactId");

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_messagingContactId_fkey" FOREIGN KEY ("messagingContactId") REFERENCES "messaging_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
