import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'professor', 'student');
  CREATE TYPE "public"."enum_modules_type" AS ENUM('modulo-teorico', 'modulo-pratico', 'atividade-avaliativa', 'recurso');
  CREATE TYPE "public"."enum_modules_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__modules_v_version_type" AS ENUM('modulo-teorico', 'modulo-pratico', 'atividade-avaliativa', 'recurso');
  CREATE TYPE "public"."enum__modules_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_offers_status" AS ENUM('active', 'archived');
  CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_activities_type" AS ENUM('individual', 'group');
  CREATE TYPE "public"."enum_scores_entity_type" AS ENUM('student', 'group');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'student' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "courses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"summary" varchar,
  	"workload_theoretical" numeric,
  	"workload_practical" numeric,
  	"instructor_id" integer,
  	"visibility" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "modules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"type" "enum_modules_type",
  	"course_id" integer,
  	"content" varchar,
  	"order" numeric DEFAULT 0,
  	"visible" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_modules_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_modules_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_type" "enum__modules_v_version_type",
  	"version_course_id" integer,
  	"version_content" varchar,
  	"version_order" numeric DEFAULT 0,
  	"version_visible" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__modules_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "offers_logs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"timestamp" timestamp(3) with time zone NOT NULL,
  	"action" varchar NOT NULL,
  	"details" varchar,
  	"performed_by_id" integer
  );
  
  CREATE TABLE "offers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"period" varchar NOT NULL,
  	"status" "enum_offers_status" DEFAULT 'active' NOT NULL,
  	"course_id" integer NOT NULL,
  	"instructor_id" integer,
  	"current_module_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "offers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"body" jsonb,
  	"status" "enum_posts_status" DEFAULT 'draft' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"offer_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"category" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"offer_id" integer NOT NULL,
  	"acronym" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"weight" numeric NOT NULL,
  	"type" "enum_activities_type" DEFAULT 'individual' NOT NULL,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "student_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"offer_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "student_groups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "scores" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"offer_id" integer NOT NULL,
  	"activity_id" integer NOT NULL,
  	"entity_type" "enum_scores_entity_type" NOT NULL,
  	"student_id" integer,
  	"group_id" integer,
  	"percentage" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"courses_id" integer,
  	"modules_id" integer,
  	"offers_id" integer,
  	"posts_id" integer,
  	"media_id" integer,
  	"activities_id" integer,
  	"student_groups_id" integer,
  	"scores_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_modules_v" ADD CONSTRAINT "_modules_v_parent_id_modules_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_modules_v" ADD CONSTRAINT "_modules_v_version_course_id_courses_id_fk" FOREIGN KEY ("version_course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "offers_logs" ADD CONSTRAINT "offers_logs_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "offers_logs" ADD CONSTRAINT "offers_logs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "offers" ADD CONSTRAINT "offers_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "offers" ADD CONSTRAINT "offers_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "offers" ADD CONSTRAINT "offers_current_module_id_modules_id_fk" FOREIGN KEY ("current_module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "offers_rels" ADD CONSTRAINT "offers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "offers_rels" ADD CONSTRAINT "offers_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activities" ADD CONSTRAINT "activities_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "student_groups" ADD CONSTRAINT "student_groups_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "student_groups_rels" ADD CONSTRAINT "student_groups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."student_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "student_groups_rels" ADD CONSTRAINT "student_groups_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scores" ADD CONSTRAINT "scores_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scores" ADD CONSTRAINT "scores_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scores" ADD CONSTRAINT "scores_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scores" ADD CONSTRAINT "scores_group_id_student_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."student_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_modules_fk" FOREIGN KEY ("modules_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_offers_fk" FOREIGN KEY ("offers_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activities_fk" FOREIGN KEY ("activities_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_student_groups_fk" FOREIGN KEY ("student_groups_id") REFERENCES "public"."student_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scores_fk" FOREIGN KEY ("scores_id") REFERENCES "public"."scores"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "courses_code_idx" ON "courses" USING btree ("code");
  CREATE UNIQUE INDEX "courses_slug_idx" ON "courses" USING btree ("slug");
  CREATE INDEX "courses_instructor_idx" ON "courses" USING btree ("instructor_id");
  CREATE INDEX "courses_updated_at_idx" ON "courses" USING btree ("updated_at");
  CREATE INDEX "courses_created_at_idx" ON "courses" USING btree ("created_at");
  CREATE INDEX "modules_course_idx" ON "modules" USING btree ("course_id");
  CREATE INDEX "modules_updated_at_idx" ON "modules" USING btree ("updated_at");
  CREATE INDEX "modules_created_at_idx" ON "modules" USING btree ("created_at");
  CREATE INDEX "modules__status_idx" ON "modules" USING btree ("_status");
  CREATE INDEX "_modules_v_parent_idx" ON "_modules_v" USING btree ("parent_id");
  CREATE INDEX "_modules_v_version_version_course_idx" ON "_modules_v" USING btree ("version_course_id");
  CREATE INDEX "_modules_v_version_version_updated_at_idx" ON "_modules_v" USING btree ("version_updated_at");
  CREATE INDEX "_modules_v_version_version_created_at_idx" ON "_modules_v" USING btree ("version_created_at");
  CREATE INDEX "_modules_v_version_version__status_idx" ON "_modules_v" USING btree ("version__status");
  CREATE INDEX "_modules_v_created_at_idx" ON "_modules_v" USING btree ("created_at");
  CREATE INDEX "_modules_v_updated_at_idx" ON "_modules_v" USING btree ("updated_at");
  CREATE INDEX "_modules_v_latest_idx" ON "_modules_v" USING btree ("latest");
  CREATE INDEX "_modules_v_autosave_idx" ON "_modules_v" USING btree ("autosave");
  CREATE INDEX "offers_logs_order_idx" ON "offers_logs" USING btree ("_order");
  CREATE INDEX "offers_logs_parent_id_idx" ON "offers_logs" USING btree ("_parent_id");
  CREATE INDEX "offers_logs_performed_by_idx" ON "offers_logs" USING btree ("performed_by_id");
  CREATE INDEX "offers_course_idx" ON "offers" USING btree ("course_id");
  CREATE INDEX "offers_instructor_idx" ON "offers" USING btree ("instructor_id");
  CREATE INDEX "offers_current_module_idx" ON "offers" USING btree ("current_module_id");
  CREATE INDEX "offers_updated_at_idx" ON "offers" USING btree ("updated_at");
  CREATE INDEX "offers_created_at_idx" ON "offers" USING btree ("created_at");
  CREATE INDEX "offers_rels_order_idx" ON "offers_rels" USING btree ("order");
  CREATE INDEX "offers_rels_parent_idx" ON "offers_rels" USING btree ("parent_id");
  CREATE INDEX "offers_rels_path_idx" ON "offers_rels" USING btree ("path");
  CREATE INDEX "offers_rels_users_id_idx" ON "offers_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  CREATE INDEX "posts_offer_idx" ON "posts" USING btree ("offer_id");
  CREATE INDEX "posts_updated_at_idx" ON "posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");
  CREATE INDEX "media_category_idx" ON "media" USING btree ("category");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "activities_offer_idx" ON "activities" USING btree ("offer_id");
  CREATE INDEX "activities_updated_at_idx" ON "activities" USING btree ("updated_at");
  CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");
  CREATE INDEX "student_groups_offer_idx" ON "student_groups" USING btree ("offer_id");
  CREATE INDEX "student_groups_updated_at_idx" ON "student_groups" USING btree ("updated_at");
  CREATE INDEX "student_groups_created_at_idx" ON "student_groups" USING btree ("created_at");
  CREATE INDEX "student_groups_rels_order_idx" ON "student_groups_rels" USING btree ("order");
  CREATE INDEX "student_groups_rels_parent_idx" ON "student_groups_rels" USING btree ("parent_id");
  CREATE INDEX "student_groups_rels_path_idx" ON "student_groups_rels" USING btree ("path");
  CREATE INDEX "student_groups_rels_users_id_idx" ON "student_groups_rels" USING btree ("users_id");
  CREATE INDEX "scores_offer_idx" ON "scores" USING btree ("offer_id");
  CREATE INDEX "scores_activity_idx" ON "scores" USING btree ("activity_id");
  CREATE INDEX "scores_student_idx" ON "scores" USING btree ("student_id");
  CREATE INDEX "scores_group_idx" ON "scores" USING btree ("group_id");
  CREATE INDEX "scores_updated_at_idx" ON "scores" USING btree ("updated_at");
  CREATE INDEX "scores_created_at_idx" ON "scores" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_courses_id_idx" ON "payload_locked_documents_rels" USING btree ("courses_id");
  CREATE INDEX "payload_locked_documents_rels_modules_id_idx" ON "payload_locked_documents_rels" USING btree ("modules_id");
  CREATE INDEX "payload_locked_documents_rels_offers_id_idx" ON "payload_locked_documents_rels" USING btree ("offers_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("activities_id");
  CREATE INDEX "payload_locked_documents_rels_student_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("student_groups_id");
  CREATE INDEX "payload_locked_documents_rels_scores_id_idx" ON "payload_locked_documents_rels" USING btree ("scores_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "courses" CASCADE;
  DROP TABLE "modules" CASCADE;
  DROP TABLE "_modules_v" CASCADE;
  DROP TABLE "offers_logs" CASCADE;
  DROP TABLE "offers" CASCADE;
  DROP TABLE "offers_rels" CASCADE;
  DROP TABLE "posts" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "activities" CASCADE;
  DROP TABLE "student_groups" CASCADE;
  DROP TABLE "student_groups_rels" CASCADE;
  DROP TABLE "scores" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_modules_type";
  DROP TYPE "public"."enum_modules_status";
  DROP TYPE "public"."enum__modules_v_version_type";
  DROP TYPE "public"."enum__modules_v_version_status";
  DROP TYPE "public"."enum_offers_status";
  DROP TYPE "public"."enum_posts_status";
  DROP TYPE "public"."enum_activities_type";
  DROP TYPE "public"."enum_scores_entity_type";`);
}
