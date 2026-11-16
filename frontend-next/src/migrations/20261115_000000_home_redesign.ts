import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop old array tables (services + processSteps)
  await db.execute(sql`DROP TABLE IF EXISTS "payload"."home_services" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "payload"."home_process_steps" CASCADE`);

  // Drop old enum types
  await db.execute(sql`DROP TYPE IF EXISTS "payload"."enum_home_services_icon_name" CASCADE`);
  await db.execute(sql`DROP TYPE IF EXISTS "payload"."enum_home_process_steps_symbol" CASCADE`);

  // Drop removed columns from home table
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "hero_description"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "hero_primary_button_text"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "hero_secondary_button_text"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "services_title"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "services_description"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "process_title"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "process_description"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "cta_description"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "cta_whatsapp_button_text"`);

  // Add new columns
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "hero_cta" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "hero_description" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "sites_label" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "sistemas_label" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "reforcos_label" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "sites_title" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "sites_description" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "sistemas_title" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "sistemas_description" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "reforcos_title" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "reforcos_description" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "equipes_cell_one_title" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "equipes_cell_one_description" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "equipes_cell_two_title" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "equipes_cell_two_description" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "equipes_cell_three_title" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "equipes_cell_three_description" varchar`);
  await db.execute(sql`ALTER TABLE "payload"."home" ADD COLUMN IF NOT EXISTS "cta_button_text" varchar`);

  // Clear existing home document so onInit seed re-populates with the new structure
  await db.execute(sql`DELETE FROM "payload"."home"`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "payload"."enum_home_services_icon_name" AS ENUM('layout-grid', 'layers', 'database', 'smartphone');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "payload"."enum_home_process_steps_symbol" AS ENUM('<', '/', '>');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payload"."home_services" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "icon_name" "payload"."enum_home_services_icon_name" DEFAULT 'layout-grid' NOT NULL,
      "title" varchar NOT NULL,
      "description" varchar NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payload"."home_process_steps" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "step_number" varchar NOT NULL,
      "symbol" "payload"."enum_home_process_steps_symbol" NOT NULL,
      "title" varchar NOT NULL,
      "description" varchar NOT NULL
    )
  `);
}
