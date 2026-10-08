import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activities_category" AS ENUM('regular', 'extra');
  ALTER TABLE "activities" ADD COLUMN "category" "enum_activities_category" DEFAULT 'regular' NOT NULL;`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activities" DROP COLUMN "category";
  DROP TYPE "public"."enum_activities_category";`);
}
