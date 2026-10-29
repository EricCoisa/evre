-- CreateEnum
CREATE TYPE "ProposalSendChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'MANUAL');

-- AlterTable: cast explícito — a coluna já tem linha gravada, o diff automático dropava e recriava.
ALTER TABLE "proposal_sends"
  ALTER COLUMN "channel" TYPE "ProposalSendChannel" USING ("channel"::"ProposalSendChannel");
