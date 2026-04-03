import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" ADD COLUMN "cover_image_id" integer;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "courses_cover_image_idx" ON "courses" USING btree ("cover_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" DROP CONSTRAINT "courses_cover_image_id_media_id_fk";
  
  DROP INDEX "courses_cover_image_idx";
  ALTER TABLE "courses" DROP COLUMN "cover_image_id";`)
}
