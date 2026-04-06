import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // ── 1. Rename main table ────────────────────────────────────────────────────
  await db.execute(sql`ALTER TABLE IF EXISTS "cadernos" RENAME TO "tesselas";`)

  // ── 2. Rename relationships table and its columns ──────────────────────────
  await db.execute(sql`ALTER TABLE IF EXISTS "cadernos_rels" RENAME TO "tesselas_rels";`)

  // Rename parent FK column index and constraint
  await db.execute(sql`
    ALTER INDEX IF EXISTS "cadernos_rels_order_idx"  RENAME TO "tesselas_rels_order_idx";
    ALTER INDEX IF EXISTS "cadernos_rels_parent_id_idx" RENAME TO "tesselas_rels_parent_id_idx";
    ALTER INDEX IF EXISTS "cadernos_rels_path_idx"   RENAME TO "tesselas_rels_path_idx";
  `)

  // Rename the FK constraint on parent_id to reference tesselas
  await db.execute(sql`
    ALTER TABLE IF EXISTS "tesselas_rels"
      RENAME CONSTRAINT IF EXISTS "cadernos_rels_parent_fk" TO "tesselas_rels_parent_fk";
  `)

  // Rename self-referencing cadernos_id column → tesselas_id
  await db.execute(sql`
    ALTER TABLE IF EXISTS "tesselas_rels"
      RENAME COLUMN IF EXISTS "cadernos_id" TO "tesselas_id";
  `)

  // Update path values: relatedCadernos → relatedTesselas
  await db.execute(sql`
    UPDATE "tesselas_rels"
    SET path = 'relatedTesselas'
    WHERE path = 'relatedCadernos';
  `)

  // ── 3. Rename versions table ───────────────────────────────────────────────
  await db.execute(sql`ALTER TABLE IF EXISTS "cadernos_versions" RENAME TO "tesselas_versions";`)

  await db.execute(sql`
    ALTER INDEX IF EXISTS "cadernos_versions_version_slug_idx" RENAME TO "tesselas_versions_version_slug_idx";
    ALTER INDEX IF EXISTS "cadernos_versions_created_at_idx"   RENAME TO "tesselas_versions_created_at_idx";
    ALTER INDEX IF EXISTS "cadernos_versions_updated_at_idx"   RENAME TO "tesselas_versions_updated_at_idx";
  `)

  // ── 4. Rename versions relationships table ─────────────────────────────────
  await db.execute(sql`ALTER TABLE IF EXISTS "cadernos_versions_rels" RENAME TO "tesselas_versions_rels";`)

  await db.execute(sql`
    ALTER TABLE IF EXISTS "tesselas_versions_rels"
      RENAME COLUMN IF EXISTS "cadernos_id" TO "tesselas_id";
  `)

  await db.execute(sql`
    UPDATE "tesselas_versions_rels"
    SET path = 'relatedTesselas'
    WHERE path = 'relatedCadernos';
  `)

  // ── 5. Add tags text column to tesselas (and versions) ────────────────────
  await db.execute(sql`
    ALTER TABLE IF EXISTS "tesselas"
      ADD COLUMN IF NOT EXISTS "tags" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE IF EXISTS "tesselas_versions"
      ADD COLUMN IF NOT EXISTS "version_tags" varchar;
  `)

  // ── 6. Update media_rels: add tesselas_id column ───────────────────────────
  await db.execute(sql`
    ALTER TABLE IF EXISTS "media_rels"
      ADD COLUMN IF NOT EXISTS "tesselas_id" integer
        REFERENCES "public"."tesselas"("id") ON DELETE cascade ON UPDATE no action;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "media_rels_tesselas_id_idx"
      ON "media_rels" USING btree ("tesselas_id");
  `)

  // Migrate any existing media_rels rows that pointed to cadernos → tesselas
  await db.execute(sql`
    ALTER TABLE IF EXISTS "media_rels"
      RENAME COLUMN IF EXISTS "cadernos_id" TO "tesselas_id_old";
  `)
  await db.execute(sql`
    UPDATE "media_rels" SET "tesselas_id" = "tesselas_id_old"
    WHERE "tesselas_id_old" IS NOT NULL;
  `)
  await db.execute(sql`
    ALTER TABLE IF EXISTS "media_rels"
      DROP COLUMN IF EXISTS "tesselas_id_old";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Reverse: tesselas → cadernos
  await db.execute(sql`ALTER TABLE IF EXISTS "tesselas" RENAME TO "cadernos";`)
  await db.execute(sql`ALTER TABLE IF EXISTS "tesselas_rels" RENAME TO "cadernos_rels";`)
  await db.execute(sql`
    ALTER TABLE IF EXISTS "cadernos_rels"
      RENAME COLUMN IF EXISTS "tesselas_id" TO "cadernos_id";
  `)
  await db.execute(sql`
    UPDATE "cadernos_rels"
    SET path = 'relatedCadernos'
    WHERE path = 'relatedTesselas';
  `)
  await db.execute(sql`ALTER TABLE IF EXISTS "tesselas_versions" RENAME TO "cadernos_versions";`)
  await db.execute(sql`ALTER TABLE IF EXISTS "tesselas_versions_rels" RENAME TO "cadernos_versions_rels";`)
  await db.execute(sql`
    ALTER TABLE IF EXISTS "cadernos_versions_rels"
      RENAME COLUMN IF EXISTS "tesselas_id" TO "cadernos_id";
  `)
  await db.execute(sql`
    UPDATE "cadernos_versions_rels"
    SET path = 'relatedCadernos'
    WHERE path = 'relatedTesselas';
  `)
  await db.execute(sql`
    ALTER TABLE IF EXISTS "media_rels"
      RENAME COLUMN IF EXISTS "tesselas_id" TO "cadernos_id";
  `)
}
