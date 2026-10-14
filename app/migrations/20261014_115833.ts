import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"period" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"active_term_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "terms_id" integer;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_active_term_id_terms_id_fk" FOREIGN KEY ("active_term_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "terms_period_idx" ON "terms" USING btree ("period");
  CREATE INDEX "terms_updated_at_idx" ON "terms" USING btree ("updated_at");
  CREATE INDEX "terms_created_at_idx" ON "terms" USING btree ("created_at");
  CREATE INDEX "site_settings_active_term_idx" ON "site_settings" USING btree ("active_term_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_terms_fk" FOREIGN KEY ("terms_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_terms_id_idx" ON "payload_locked_documents_rels" USING btree ("terms_id");`)

  // Keep today's behaviour: every period that already has an offer becomes a
  // general offer, and the most recent one is the active one.
  await db.execute(sql`
   INSERT INTO "terms" ("period")
   SELECT DISTINCT btrim("period") FROM "offers"
   WHERE btrim("period") ~ '^[0-9]{4}\\.[12]$'
   ON CONFLICT ("period") DO NOTHING;

  INSERT INTO "site_settings" ("active_term_id", "updated_at", "created_at")
   SELECT "id", now(), now() FROM "terms"
   ORDER BY split_part("period", '.', 1)::int DESC, split_part("period", '.', 2)::int DESC
   LIMIT 1;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "terms" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_terms_fk";
  
  DROP INDEX "payload_locked_documents_rels_terms_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "terms_id";`)
}
