import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_activities_mode" ADD VALUE 'questions';
  CREATE TABLE "activities_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"name" varchar,
  	"weight" numeric DEFAULT 1
  );
  
  ALTER TABLE "scores" ADD COLUMN "question_scores" jsonb;
  ALTER TABLE "activities_questions" ADD CONSTRAINT "activities_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activities_questions_order_idx" ON "activities_questions" USING btree ("_order");
  CREATE INDEX "activities_questions_parent_id_idx" ON "activities_questions" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "activities_questions" CASCADE;
  ALTER TABLE "activities" ALTER COLUMN "mode" SET DATA TYPE text;
  ALTER TABLE "activities" ALTER COLUMN "mode" SET DEFAULT 'graded'::text;
  DROP TYPE "public"."enum_activities_mode";
  CREATE TYPE "public"."enum_activities_mode" AS ENUM('graded', 'checklist');
  ALTER TABLE "activities" ALTER COLUMN "mode" SET DEFAULT 'graded'::"public"."enum_activities_mode";
  ALTER TABLE "activities" ALTER COLUMN "mode" SET DATA TYPE "public"."enum_activities_mode" USING "mode"::"public"."enum_activities_mode";
  ALTER TABLE "scores" DROP COLUMN "question_scores";`)
}
