import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activities" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "activities" ADD COLUMN "comment" varchar;`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activities" DROP COLUMN "due_date";
  ALTER TABLE "activities" DROP COLUMN "comment";`);
}
