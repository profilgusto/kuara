import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import path from "path";
import { fileURLToPath } from "url";

import { Users } from "./collections/Users.ts";
import { Courses } from "./collections/Courses.ts";
import { Modules } from "./collections/Modules.ts";
import { Tesselas } from "./collections/Tesselas.ts";
import { Offers } from "./collections/Offers.ts";
import { Posts } from "./collections/Posts.ts";
import { Media } from "./collections/Media.ts";
import { Activities } from "./collections/Activities.ts";
import { StudentGroups } from "./collections/StudentGroups.ts";
import { Scores } from "./collections/Scores.ts";
import { References } from "./collections/References.ts";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Note: PAYLOAD_SECRET is validated at deploy time by scripts/deploy.sh.
// Do NOT add a module-level guard here — payload.config.ts is imported during
// `next build` (NODE_ENV=production) before runtime secrets are available,
// and a top-level throw would break static page collection.

export default buildConfig({
  defaultMaxTextLength: 800000, // ~800 KB — allows large MDX module content (default is 40,000)
  routes: {
    // The admin panel lives at /payload (served as /kuara/payload once
    // Next.js applies basePath). Must stay in sync with the route folder
    // app/(payload)/payload/[[...segments]].
    //
    // `api` carries the basePath explicitly: Payload has no basePath
    // awareness, and the admin client issues plain fetch() calls against
    // routes.api, which Next.js does NOT prefix (unlike <Link>/router.push,
    // which is why routes.admin must stay basePath-relative).
    admin: "/payload",
    api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api`,
  },
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      views: {
        todos: {
          Component: "@/admin/views/TodosView",
          path: "/todos",
        },
      },
      afterNavLinks: ["@/admin/components/TodosNavLink"],
    },
  },
  collections: [
    Users,
    Courses,
    Modules,
    Tesselas,
    Offers,
    Posts,
    Media,
    Activities,
    StudentGroups,
    Scores,
    References,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "CHANGE-ME-IN-PRODUCTION",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  plugins: [
    s3Storage({
      collections: {
        media: {
          // Keep URLs on your own domain — Nginx proxies /media/ → MinIO
          generateFileURL: ({ filename }) => `/media/${filename}`,
        },
      },
      bucket: process.env.S3_BUCKET || "kuara-media",
      config: {
        endpoint: process.env.S3_ENDPOINT || "http://minio:9000",
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY || "",
          secretAccessKey: process.env.S3_SECRET_KEY || "",
        },
        region: "us-east-1",
        forcePathStyle: true, // required for MinIO path-style URLs
      },
    }),
  ],
  db: postgresAdapter({
    // push:true is convenient in dev (auto-syncs schema on startup).
    // In production (NODE_ENV=production) it is disabled — use explicit
    // migrations instead: npx payload migrate:create → npx payload migrate.
    push: process.env.NODE_ENV !== "production",
    migrationDir: path.resolve(dirname, "migrations"),
    pool: {
      connectionString: process.env.DATABASE_URL || "",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  }),
});
