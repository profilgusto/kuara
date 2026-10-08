import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activities_mode" AS ENUM('graded', 'checklist');
  CREATE TABLE "activities_tasks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  ALTER TABLE "activities" ADD COLUMN "mode" "enum_activities_mode" DEFAULT 'graded' NOT NULL;
  ALTER TABLE "scores" ADD COLUMN "completed_tasks" jsonb;
  ALTER TABLE "activities_tasks" ADD CONSTRAINT "activities_tasks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activities_tasks_order_idx" ON "activities_tasks" USING btree ("_order");
  CREATE INDEX "activities_tasks_parent_id_idx" ON "activities_tasks" USING btree ("_parent_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "activities_tasks" CASCADE;
  ALTER TABLE "activities" DROP COLUMN "mode";
  ALTER TABLE "scores" DROP COLUMN "completed_tasks";
  DROP TYPE "public"."enum_activities_mode";`);
}
