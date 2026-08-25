import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // All rename operations are guarded: if cadernos/tesselas tables never existed
  // in this environment (e.g. a fresh prod DB), all renames are silently skipped.

  // ── 1. Rename main table ────────────────────────────────────────────────────
  await db.execute(sql`ALTER TABLE IF EXISTS "cadernos" RENAME TO "tesselas";`);

  // ── 2. Rename relationships table and its columns ──────────────────────────
  await db.execute(
    sql`ALTER TABLE IF EXISTS "cadernos_rels" RENAME TO "tesselas_rels";`,
  );

  // Rename parent FK column indexes
  await db.execute(
    sql`ALTER INDEX IF EXISTS "cadernos_rels_order_idx"       RENAME TO "tesselas_rels_order_idx";`,
  );
  await db.execute(
    sql`ALTER INDEX IF EXISTS "cadernos_rels_parent_id_idx"   RENAME TO "tesselas_rels_parent_id_idx";`,
  );
  await db.execute(
    sql`ALTER INDEX IF EXISTS "cadernos_rels_path_idx"        RENAME TO "tesselas_rels_path_idx";`,
  );

  // Rename FK constraint (IF EXISTS not supported by PG — use DO block)
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cadernos_rels_parent_fk') THEN
        ALTER TABLE "tesselas_rels" RENAME CONSTRAINT "cadernos_rels_parent_fk" TO "tesselas_rels_parent_fk";
      END IF;
    END $$;
  `);

  // Rename cadernos_id column → tesselas_id (RENAME COLUMN IF EXISTS not supported)
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tesselas_rels' AND column_name = 'cadernos_id'
      ) THEN
        ALTER TABLE "tesselas_rels" RENAME COLUMN "cadernos_id" TO "tesselas_id";
      END IF;
    END $$;
  `);

  // Update path values — only if the table exists
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesselas_rels') THEN
        UPDATE "tesselas_rels" SET path = 'relatedTesselas' WHERE path = 'relatedCadernos';
      END IF;
    END $$;
  `);

  // ── 3. Rename versions table ───────────────────────────────────────────────
  await db.execute(
    sql`ALTER TABLE IF EXISTS "cadernos_versions" RENAME TO "tesselas_versions";`,
  );

  await db.execute(
    sql`ALTER INDEX IF EXISTS "cadernos_versions_version_slug_idx" RENAME TO "tesselas_versions_version_slug_idx";`,
  );
  await db.execute(
    sql`ALTER INDEX IF EXISTS "cadernos_versions_created_at_idx"   RENAME TO "tesselas_versions_created_at_idx";`,
  );
  await db.execute(
    sql`ALTER INDEX IF EXISTS "cadernos_versions_updated_at_idx"   RENAME TO "tesselas_versions_updated_at_idx";`,
  );

  // ── 4. Rename versions relationships table ─────────────────────────────────
  await db.execute(
    sql`ALTER TABLE IF EXISTS "cadernos_versions_rels" RENAME TO "tesselas_versions_rels";`,
  );

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tesselas_versions_rels' AND column_name = 'cadernos_id'
      ) THEN
        ALTER TABLE "tesselas_versions_rels" RENAME COLUMN "cadernos_id" TO "tesselas_id";
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesselas_versions_rels') THEN
        UPDATE "tesselas_versions_rels" SET path = 'relatedTesselas' WHERE path = 'relatedCadernos';
      END IF;
    END $$;
  `);

  // ── 5. Add tags column to tesselas (and versions) — only if table exists ──
  await db.execute(sql`
    ALTER TABLE IF EXISTS "tesselas"
      ADD COLUMN IF NOT EXISTS "tags" varchar;
  `);
  await db.execute(sql`
    ALTER TABLE IF EXISTS "tesselas_versions"
      ADD COLUMN IF NOT EXISTS "version_tags" varchar;
  `);

  // ── 6. Update media_rels: add tesselas_id column (only if tesselas exists) ─
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesselas') THEN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'media_rels' AND column_name = 'tesselas_id'
        ) THEN
          ALTER TABLE "media_rels"
            ADD COLUMN "tesselas_id" integer
              REFERENCES "public"."tesselas"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
        CREATE INDEX IF NOT EXISTS "media_rels_tesselas_id_idx" ON "media_rels" USING btree ("tesselas_id");
      END IF;
    END $$;
  `);

  // Migrate any existing media_rels rows that pointed to cadernos → tesselas
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'media_rels' AND column_name = 'cadernos_id'
      ) THEN
        ALTER TABLE "media_rels" RENAME COLUMN "cadernos_id" TO "tesselas_id_old";
        UPDATE "media_rels" SET "tesselas_id" = "tesselas_id_old" WHERE "tesselas_id_old" IS NOT NULL;
        ALTER TABLE "media_rels" DROP COLUMN "tesselas_id_old";
      END IF;
    END $$;
  `);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  // Reverse: tesselas → cadernos
  await db.execute(sql`ALTER TABLE IF EXISTS "tesselas" RENAME TO "cadernos";`);
  await db.execute(
    sql`ALTER TABLE IF EXISTS "tesselas_rels" RENAME TO "cadernos_rels";`,
  );
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cadernos_rels' AND column_name = 'tesselas_id'
      ) THEN
        ALTER TABLE "cadernos_rels" RENAME COLUMN "tesselas_id" TO "cadernos_id";
      END IF;
    END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cadernos_rels') THEN
        UPDATE "cadernos_rels" SET path = 'relatedCadernos' WHERE path = 'relatedTesselas';
      END IF;
    END $$;
  `);
  await db.execute(
    sql`ALTER TABLE IF EXISTS "tesselas_versions" RENAME TO "cadernos_versions";`,
  );
  await db.execute(
    sql`ALTER TABLE IF EXISTS "tesselas_versions_rels" RENAME TO "cadernos_versions_rels";`,
  );
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cadernos_versions_rels' AND column_name = 'tesselas_id'
      ) THEN
        ALTER TABLE "cadernos_versions_rels" RENAME COLUMN "tesselas_id" TO "cadernos_id";
      END IF;
    END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cadernos_versions_rels') THEN
        UPDATE "cadernos_versions_rels" SET path = 'relatedCadernos' WHERE path = 'relatedTesselas';
      END IF;
    END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'media_rels' AND column_name = 'tesselas_id'
      ) THEN
        ALTER TABLE "media_rels" RENAME COLUMN "tesselas_id" TO "cadernos_id";
      END IF;
    END $$;
  `);
}
