import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "modules" ADD COLUMN "question_offsets" jsonb;
  ALTER TABLE "_modules_v" ADD COLUMN "version_question_offsets" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "modules" DROP COLUMN "question_offsets";
  ALTER TABLE "_modules_v" DROP COLUMN "version_question_offsets";`)
}
