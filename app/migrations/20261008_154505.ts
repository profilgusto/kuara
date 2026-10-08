import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "scores" ADD COLUMN "enrollment_id" integer;
  ALTER TABLE "scores" ADD CONSTRAINT "scores_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "scores_enrollment_idx" ON "scores" USING btree ("enrollment_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "scores" DROP CONSTRAINT "scores_enrollment_id_enrollments_id_fk";
  
  DROP INDEX "scores_enrollment_idx";
  ALTER TABLE "scores" DROP COLUMN "enrollment_id";`);
}
