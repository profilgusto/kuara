import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "question_offsets" jsonb;
    ALTER TABLE "_modules_v" ADD COLUMN IF NOT EXISTS "version_question_offsets" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "modules" DROP COLUMN IF EXISTS "question_offsets";
    ALTER TABLE "_modules_v" DROP COLUMN IF EXISTS "version_question_offsets";
  `)
}
