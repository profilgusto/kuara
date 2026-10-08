import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_enrollments_class_group" AS ENUM('A', 'B');
  CREATE TABLE "enrollments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"offer_id" integer NOT NULL,
  	"registration" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"class_group" "enum_enrollments_class_group",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "enrollments_id" integer;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "enrollments_offer_idx" ON "enrollments" USING btree ("offer_id");
  CREATE INDEX "enrollments_registration_idx" ON "enrollments" USING btree ("registration");
  CREATE INDEX "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_enrollments_id_idx" ON "payload_locked_documents_rels" USING btree ("enrollments_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "enrollments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "enrollments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_enrollments_fk";
  
  DROP INDEX "payload_locked_documents_rels_enrollments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "enrollments_id";
  DROP TYPE "public"."enum_enrollments_class_group";`);
}
