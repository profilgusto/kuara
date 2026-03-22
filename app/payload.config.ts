import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import path from "path";
import { fileURLToPath } from "url";

import { Users } from "./collections/Users.ts";
import { Courses } from "./collections/Courses.ts";
import { Modules } from "./collections/Modules.ts";
import { Offers } from "./collections/Offers.ts";
import { Posts } from "./collections/Posts.ts";
import { Media } from "./collections/Media.ts";
import { Activities } from "./collections/Activities.ts";
import { StudentGroups } from "./collections/StudentGroups.ts";
import { Scores } from "./collections/Scores.ts";
import { References } from "./collections/References.ts";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Fail fast in production if a required secret is missing
if (process.env.NODE_ENV === "production" && !process.env.PAYLOAD_SECRET) {
  throw new Error(
    "PAYLOAD_SECRET environment variable must be set in production",
  );
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Courses,
    Modules,
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
