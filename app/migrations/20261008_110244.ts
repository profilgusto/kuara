import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_account_requests_requested_role" AS ENUM('student', 'professor');
  CREATE TYPE "public"."enum_account_requests_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TABLE "account_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"requested_role" "enum_account_requests_requested_role" DEFAULT 'student' NOT NULL,
  	"message" varchar,
  	"status" "enum_account_requests_status" DEFAULT 'pending' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "account_requests_id" integer;
  CREATE INDEX "account_requests_updated_at_idx" ON "account_requests" USING btree ("updated_at");
  CREATE INDEX "account_requests_created_at_idx" ON "account_requests" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_account_requests_fk" FOREIGN KEY ("account_requests_id") REFERENCES "public"."account_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_account_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("account_requests_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "account_requests" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "account_requests" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_account_requests_fk";
  
  DROP INDEX "payload_locked_documents_rels_account_requests_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "account_requests_id";
  DROP TYPE "public"."enum_account_requests_requested_role";
  DROP TYPE "public"."enum_account_requests_status";`);
}
