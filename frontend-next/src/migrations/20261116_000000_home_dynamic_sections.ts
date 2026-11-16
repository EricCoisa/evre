import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop legacy array tables
  await db.execute(sql`DROP TABLE IF EXISTS "payload"."home_site_demos" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "payload"."home_sistema_demos" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "payload"."home_equipes_cards" CASCADE`);

  // Drop legacy columns from home table
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "sites_label"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "sites_title"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "sites_description"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "sistemas_label"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "sistemas_title"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "sistemas_description"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "reforcos_label"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "reforcos_title"`);
  await db.execute(sql`ALTER TABLE "payload"."home" DROP COLUMN IF EXISTS "reforcos_description"`);

  // Enum for mediaPosition on showcase block
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "payload"."enum_home_blocks_showcase_media_position" AS ENUM('right', 'left');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  // Tables for showcase blocks
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payload"."home_blocks_showcase" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "anchor_id" varchar NOT NULL,
      "nav_label" varchar,
      "label" varchar NOT NULL,
      "title" varchar NOT NULL,
      "description" varchar NOT NULL,
      "media_position" "payload"."enum_home_blocks_showcase_media_position" DEFAULT 'right',
      "block_name" varchar
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payload"."home_blocks_showcase_demos" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "url" varchar,
      "label" varchar
    );
  `);

  // Tables for cardsGrid blocks
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payload"."home_blocks_cards_grid" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "anchor_id" varchar NOT NULL,
      "nav_label" varchar,
      "label" varchar NOT NULL,
      "title" varchar NOT NULL,
      "description" varchar NOT NULL,
      "block_name" varchar
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payload"."home_blocks_cards_grid_cards" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "description" varchar
    );
  `);

  // Clear existing home document so onInit seed re-populates with the new dynamic structure
  await db.execute(sql`DELETE FROM "payload"."home"`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "payload"."home_blocks_showcase_demos" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "payload"."home_blocks_showcase" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "payload"."home_blocks_cards_grid_cards" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "payload"."home_blocks_cards_grid" CASCADE`);
  await db.execute(sql`DROP TYPE IF EXISTS "payload"."enum_home_blocks_showcase_media_position" CASCADE`);
}
