import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
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
import { AccountRequests } from "./collections/AccountRequests.ts";
import { Enrollments } from "./collections/Enrollments.ts";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Note: PAYLOAD_SECRET is validated at deploy time by scripts/deploy.sh.
// Do NOT add a module-level guard here — payload.config.ts is imported during
// `next build` (NODE_ENV=production) before runtime secrets are available,
// and a top-level throw would break static page collection.

// `next build` imports this file with NODE_ENV=production but without the
// runtime secrets, so the guard must not fire in that phase. At runtime (the
// server and the migrator) a missing secret would silently sign sessions with
// a publicly known key, so refuse to start instead.
function resolveSecret(): string {
  const secret = process.env.PAYLOAD_SECRET;
  if (secret) return secret;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error(
      "PAYLOAD_SECRET is not set; refusing to start in production.",
    );
  }
  return "CHANGE-ME-IN-PRODUCTION";
}

export default buildConfig({
  defaultMaxTextLength: 800000, // ~800 KB — allows large MDX module content (default is 40,000)
  routes: {
    // Both values are basePath-RELATIVE. The app is served under /kuara and
    // that prefix is always added downstream, by whichever layer consumes the
    // route — Payload's own URL helper knows the basePath and applies it:
    //
    //   ({ adminRoute, apiRoute, includeBasePath, path }) =>
    //     (includeBasePath ?? !adminRoute) ? basePath + url : url
    //
    // For an API call adminRoute is undefined, so `!adminRoute` is true and
    // Payload prefixes it. For an admin route it is set, so Payload returns
    // the bare path and Next.js's router prefixes it instead. Either way the
    // prefix lands exactly once — as long as it is not baked in here.
    //
    // Do NOT interpolate NEXT_PUBLIC_BASE_PATH into these. Doing so produced
    // POST /kuara/kuara/api/users/login → 500, which the admin surfaced as
    // "An unknown error has occurred" (Traefik access log, 2026-07-20).
    //
    // `admin` must stay in sync with app/(payload)/payload/[[...segments]].
    admin: "/payload",
    api: "/api",
  },
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      views: {
        todos: {
          Component: "@/admin/views/TodosPage",
          path: "/todos",
        },
        interactiveLibrary: {
          Component: "@/admin/views/InteractiveLibraryPage",
          path: "/interativos",
        },
      },
      afterNavLinks: [
        "@/admin/components/TodosNavLink",
        "@/admin/components/InteractiveLibraryNavLink",
      ],
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
    AccountRequests,
    Enrollments,
  ],
  // Outgoing mail (password recovery, account approval). Configured only when
  // SMTP_HOST is set: `next build` runs without runtime env, and without an
  // adapter Payload logs "Email attempted without being configured" instead
  // of sending. Dev points at the Mailpit container (docker-compose.yml).
  email: process.env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress:
          process.env.SMTP_FROM_ADDRESS || "noreply-sigra-cap@ufsj.edu.br",
        defaultFromName: process.env.SMTP_FROM_NAME || "Kuara",
        // Verifying opens a connection at startup; an SMTP outage should
        // fail the e-mail being sent, not the whole app boot.
        skipVerify: true,
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          // 465 is implicit TLS; on other ports nodemailer upgrades with
          // STARTTLS when the server offers it.
          secure: Number(process.env.SMTP_PORT || 587) === 465,
          auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS || "",
              }
            : undefined,
        },
      })
    : undefined,
  editor: lexicalEditor(),
  secret: resolveSecret(),
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  plugins: [
    s3Storage({
      collections: {
        media: {
          // Keep URLs on your own domain — next.config.mjs proxies /media/*
          // to Garage's web endpoint.
          generateFileURL: ({ filename }) => `/media/${filename}`,
        },
      },
      bucket: process.env.S3_BUCKET || "kuara-media",
      config: {
        endpoint: process.env.S3_ENDPOINT || "http://garage:3900",
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY || "",
          secretAccessKey: process.env.S3_SECRET_KEY || "",
        },
        // Must equal s3_region in garage/garage.toml — Garage rejects any
        // other region with AuthorizationHeaderMalformed.
        region: process.env.S3_REGION || "garage",
        forcePathStyle: true, // Garage is addressed by path, not by subdomain
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
