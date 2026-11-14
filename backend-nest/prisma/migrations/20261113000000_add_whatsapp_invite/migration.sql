-- AlterTable: Invite — suporte a convite via WhatsApp
-- email torna-se nullable; phone e channel adicionados
ALTER TABLE "public"."invites"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "phone"   TEXT,
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'EMAIL';

-- Índice único para convite WhatsApp por empresa (análogo ao existente por email)
CREATE UNIQUE INDEX "invites_phone_companyId_key" ON "public"."invites"("phone", "companyId");
