import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "enrollments" ADD COLUMN "group_id" integer;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_group_id_student_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."student_groups"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "enrollments_group_idx" ON "enrollments" USING btree ("group_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_group_id_student_groups_id_fk";
  
  DROP INDEX "enrollments_group_idx";
  ALTER TABLE "enrollments" DROP COLUMN "group_id";`);
}
