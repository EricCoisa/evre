import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "payload"."home_blocks_showcase" ADD COLUMN IF NOT EXISTS "demos_interactive" boolean DEFAULT true`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "payload"."home_blocks_showcase" DROP COLUMN IF EXISTS "demos_interactive"`);
}
