-- AlterTable: remove scopeRole from memberships, add canComment
ALTER TABLE "public"."memberships" DROP COLUMN "scopeRole";
ALTER TABLE "public"."memberships" ADD COLUMN "canComment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: convert invites.scopeRole from enum to text (keep column for backwards compat)
ALTER TABLE "public"."invites" ALTER COLUMN "scopeRole" TYPE TEXT USING "scopeRole"::TEXT;

-- Drop the enum type (no longer referenced by any table)
DROP TYPE IF EXISTS "public"."MembershipScopeRole";
