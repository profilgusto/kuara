import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tesselas_stage" AS ENUM('rascunho', 'em-andamento', 'finalizado', 'incrementando');
  CREATE TYPE "public"."enum_tesselas_citation_style" AS ENUM('authoryear', 'apa', 'chicago', 'numeric', 'ieee', 'vancouver');
  CREATE TYPE "public"."enum_tesselas_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__tesselas_v_version_stage" AS ENUM('rascunho', 'em-andamento', 'finalizado', 'incrementando');
  CREATE TYPE "public"."enum__tesselas_v_version_citation_style" AS ENUM('authoryear', 'apa', 'chicago', 'numeric', 'ieee', 'vancouver');
  CREATE TYPE "public"."enum__tesselas_v_version_status" AS ENUM('draft', 'published');
  ALTER TYPE "public"."enum_payload_folders_folder_type" ADD VALUE 'tesselas' BEFORE 'media';
  CREATE TABLE "modules_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"modules_id" integer,
  	"tesselas_id" integer
  );
  
  CREATE TABLE "_modules_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"modules_id" integer,
  	"tesselas_id" integer
  );
  
  CREATE TABLE "tesselas" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"authors" varchar,
  	"content" varchar,
  	"abstract" varchar,
  	"stage" "enum_tesselas_stage" DEFAULT 'rascunho',
  	"visible" boolean DEFAULT true,
  	"linkable" boolean DEFAULT true,
  	"tags" varchar,
  	"citation_style" "enum_tesselas_citation_style" DEFAULT 'authoryear',
  	"cover_image_id" integer,
  	"project" varchar,
  	"published_at" timestamp(3) with time zone,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_tesselas_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "tesselas_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"modules_id" integer,
  	"tesselas_id" integer
  );
  
  CREATE TABLE "_tesselas_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_authors" varchar,
  	"version_content" varchar,
  	"version_abstract" varchar,
  	"version_stage" "enum__tesselas_v_version_stage" DEFAULT 'rascunho',
  	"version_visible" boolean DEFAULT true,
  	"version_linkable" boolean DEFAULT true,
  	"version_tags" varchar,
  	"version_citation_style" "enum__tesselas_v_version_citation_style" DEFAULT 'authoryear',
  	"version_cover_image_id" integer,
  	"version_project" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_folder_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__tesselas_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_tesselas_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"modules_id" integer,
  	"tesselas_id" integer
  );
  
  ALTER TABLE "modules" ADD COLUMN "authors" varchar;
  ALTER TABLE "modules" ADD COLUMN "linkable" boolean DEFAULT true;
  ALTER TABLE "modules" ADD COLUMN "published_at" timestamp(3) with time zone;
  ALTER TABLE "_modules_v" ADD COLUMN "version_authors" varchar;
  ALTER TABLE "_modules_v" ADD COLUMN "version_linkable" boolean DEFAULT true;
  ALTER TABLE "_modules_v" ADD COLUMN "version_published_at" timestamp(3) with time zone;
  ALTER TABLE "media_rels" ADD COLUMN "tesselas_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tesselas_id" integer;
  ALTER TABLE "modules_rels" ADD CONSTRAINT "modules_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "modules_rels" ADD CONSTRAINT "modules_rels_modules_fk" FOREIGN KEY ("modules_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "modules_rels" ADD CONSTRAINT "modules_rels_tesselas_fk" FOREIGN KEY ("tesselas_id") REFERENCES "public"."tesselas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_modules_v_rels" ADD CONSTRAINT "_modules_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_modules_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_modules_v_rels" ADD CONSTRAINT "_modules_v_rels_modules_fk" FOREIGN KEY ("modules_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_modules_v_rels" ADD CONSTRAINT "_modules_v_rels_tesselas_fk" FOREIGN KEY ("tesselas_id") REFERENCES "public"."tesselas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tesselas" ADD CONSTRAINT "tesselas_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tesselas" ADD CONSTRAINT "tesselas_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tesselas_rels" ADD CONSTRAINT "tesselas_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tesselas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tesselas_rels" ADD CONSTRAINT "tesselas_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tesselas_rels" ADD CONSTRAINT "tesselas_rels_modules_fk" FOREIGN KEY ("modules_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tesselas_rels" ADD CONSTRAINT "tesselas_rels_tesselas_fk" FOREIGN KEY ("tesselas_id") REFERENCES "public"."tesselas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tesselas_v" ADD CONSTRAINT "_tesselas_v_parent_id_tesselas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tesselas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tesselas_v" ADD CONSTRAINT "_tesselas_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tesselas_v" ADD CONSTRAINT "_tesselas_v_version_folder_id_payload_folders_id_fk" FOREIGN KEY ("version_folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tesselas_v_rels" ADD CONSTRAINT "_tesselas_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_tesselas_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tesselas_v_rels" ADD CONSTRAINT "_tesselas_v_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tesselas_v_rels" ADD CONSTRAINT "_tesselas_v_rels_modules_fk" FOREIGN KEY ("modules_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tesselas_v_rels" ADD CONSTRAINT "_tesselas_v_rels_tesselas_fk" FOREIGN KEY ("tesselas_id") REFERENCES "public"."tesselas"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "modules_rels_order_idx" ON "modules_rels" USING btree ("order");
  CREATE INDEX "modules_rels_parent_idx" ON "modules_rels" USING btree ("parent_id");
  CREATE INDEX "modules_rels_path_idx" ON "modules_rels" USING btree ("path");
  CREATE INDEX "modules_rels_modules_id_idx" ON "modules_rels" USING btree ("modules_id");
  CREATE INDEX "modules_rels_tesselas_id_idx" ON "modules_rels" USING btree ("tesselas_id");
  CREATE INDEX "_modules_v_rels_order_idx" ON "_modules_v_rels" USING btree ("order");
  CREATE INDEX "_modules_v_rels_parent_idx" ON "_modules_v_rels" USING btree ("parent_id");
  CREATE INDEX "_modules_v_rels_path_idx" ON "_modules_v_rels" USING btree ("path");
  CREATE INDEX "_modules_v_rels_modules_id_idx" ON "_modules_v_rels" USING btree ("modules_id");
  CREATE INDEX "_modules_v_rels_tesselas_id_idx" ON "_modules_v_rels" USING btree ("tesselas_id");
  CREATE UNIQUE INDEX "tesselas_slug_idx" ON "tesselas" USING btree ("slug");
  CREATE INDEX "tesselas_cover_image_idx" ON "tesselas" USING btree ("cover_image_id");
  CREATE INDEX "tesselas_folder_idx" ON "tesselas" USING btree ("folder_id");
  CREATE INDEX "tesselas_updated_at_idx" ON "tesselas" USING btree ("updated_at");
  CREATE INDEX "tesselas_created_at_idx" ON "tesselas" USING btree ("created_at");
  CREATE INDEX "tesselas__status_idx" ON "tesselas" USING btree ("_status");
  CREATE INDEX "tesselas_rels_order_idx" ON "tesselas_rels" USING btree ("order");
  CREATE INDEX "tesselas_rels_parent_idx" ON "tesselas_rels" USING btree ("parent_id");
  CREATE INDEX "tesselas_rels_path_idx" ON "tesselas_rels" USING btree ("path");
  CREATE INDEX "tesselas_rels_courses_id_idx" ON "tesselas_rels" USING btree ("courses_id");
  CREATE INDEX "tesselas_rels_modules_id_idx" ON "tesselas_rels" USING btree ("modules_id");
  CREATE INDEX "tesselas_rels_tesselas_id_idx" ON "tesselas_rels" USING btree ("tesselas_id");
  CREATE INDEX "_tesselas_v_parent_idx" ON "_tesselas_v" USING btree ("parent_id");
  CREATE INDEX "_tesselas_v_version_version_slug_idx" ON "_tesselas_v" USING btree ("version_slug");
  CREATE INDEX "_tesselas_v_version_version_cover_image_idx" ON "_tesselas_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_tesselas_v_version_version_folder_idx" ON "_tesselas_v" USING btree ("version_folder_id");
  CREATE INDEX "_tesselas_v_version_version_updated_at_idx" ON "_tesselas_v" USING btree ("version_updated_at");
  CREATE INDEX "_tesselas_v_version_version_created_at_idx" ON "_tesselas_v" USING btree ("version_created_at");
  CREATE INDEX "_tesselas_v_version_version__status_idx" ON "_tesselas_v" USING btree ("version__status");
  CREATE INDEX "_tesselas_v_created_at_idx" ON "_tesselas_v" USING btree ("created_at");
  CREATE INDEX "_tesselas_v_updated_at_idx" ON "_tesselas_v" USING btree ("updated_at");
  CREATE INDEX "_tesselas_v_latest_idx" ON "_tesselas_v" USING btree ("latest");
  CREATE INDEX "_tesselas_v_autosave_idx" ON "_tesselas_v" USING btree ("autosave");
  CREATE INDEX "_tesselas_v_rels_order_idx" ON "_tesselas_v_rels" USING btree ("order");
  CREATE INDEX "_tesselas_v_rels_parent_idx" ON "_tesselas_v_rels" USING btree ("parent_id");
  CREATE INDEX "_tesselas_v_rels_path_idx" ON "_tesselas_v_rels" USING btree ("path");
  CREATE INDEX "_tesselas_v_rels_courses_id_idx" ON "_tesselas_v_rels" USING btree ("courses_id");
  CREATE INDEX "_tesselas_v_rels_modules_id_idx" ON "_tesselas_v_rels" USING btree ("modules_id");
  CREATE INDEX "_tesselas_v_rels_tesselas_id_idx" ON "_tesselas_v_rels" USING btree ("tesselas_id");
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_tesselas_fk" FOREIGN KEY ("tesselas_id") REFERENCES "public"."tesselas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tesselas_fk" FOREIGN KEY ("tesselas_id") REFERENCES "public"."tesselas"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_rels_tesselas_id_idx" ON "media_rels" USING btree ("tesselas_id");
  CREATE INDEX "payload_locked_documents_rels_tesselas_id_idx" ON "payload_locked_documents_rels" USING btree ("tesselas_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "modules_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_modules_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tesselas" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tesselas_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_tesselas_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_tesselas_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "modules_rels" CASCADE;
  DROP TABLE "_modules_v_rels" CASCADE;
  DROP TABLE "tesselas" CASCADE;
  DROP TABLE "tesselas_rels" CASCADE;
  DROP TABLE "_tesselas_v" CASCADE;
  DROP TABLE "_tesselas_v_rels" CASCADE;
  ALTER TABLE "media_rels" DROP CONSTRAINT "media_rels_tesselas_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tesselas_fk";
  
  ALTER TABLE "payload_folders_folder_type" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_folders_folder_type";
  CREATE TYPE "public"."enum_payload_folders_folder_type" AS ENUM('modules', 'media');
  ALTER TABLE "payload_folders_folder_type" ALTER COLUMN "value" SET DATA TYPE "public"."enum_payload_folders_folder_type" USING "value"::"public"."enum_payload_folders_folder_type";
  DROP INDEX "media_rels_tesselas_id_idx";
  DROP INDEX "payload_locked_documents_rels_tesselas_id_idx";
  ALTER TABLE "modules" DROP COLUMN "authors";
  ALTER TABLE "modules" DROP COLUMN "linkable";
  ALTER TABLE "modules" DROP COLUMN "published_at";
  ALTER TABLE "_modules_v" DROP COLUMN "version_authors";
  ALTER TABLE "_modules_v" DROP COLUMN "version_linkable";
  ALTER TABLE "_modules_v" DROP COLUMN "version_published_at";
  ALTER TABLE "media_rels" DROP COLUMN "tesselas_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tesselas_id";
  DROP TYPE "public"."enum_tesselas_stage";
  DROP TYPE "public"."enum_tesselas_citation_style";
  DROP TYPE "public"."enum_tesselas_status";
  DROP TYPE "public"."enum__tesselas_v_version_stage";
  DROP TYPE "public"."enum__tesselas_v_version_citation_style";
  DROP TYPE "public"."enum__tesselas_v_version_status";`);
}
