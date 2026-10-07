import { withPayload } from "@payloadcms/next/withPayload";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // App is served under a sub-path in production (kuara.ufsj.edu.br/kuara).
  // Fixed at build time; manual (non-Link) references use lib/base-path.ts.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,

  // ESLint is run separately via `npm run lint` (Phase 1 validation).
  // Skipping it here prevents any lint warning from blocking a production build.
  eslint: { ignoreDuringBuilds: true },

  // react-pdf ships ESM-only; include it in Next.js's SWC transform pass.
  transpilePackages: ["react-pdf"],

  // citation-js packages use dynamic requires — keep them as Node.js externals
  // so Next.js does not attempt to bundle them for the client.
  serverExternalPackages: [
    "@citation-js/core",
    "@citation-js/plugin-bibtex",
    "@citation-js/plugin-csl",
  ],

  webpack: (config) => {
    // pdfjs-dist tries to import 'canvas' in Node environments — alias it away
    config.resolve.alias.canvas = false;

    // pdf.mjs is itself a webpack bundle (it embeds its own webpack runtime).
    // Next.js's webpack recognises "__webpack_exports__" and "__webpack_require__"
    // as reserved identifiers and replaces/freezes them, which causes
    // "Object.defineProperty called on non-object" when the inner runtime tries
    // to define exports on the frozen object.
    // Our custom loader renames those variables before webpack sees the file.
    config.module.rules.push({
      test: /pdfjs-dist[\\/]build[\\/]pdf\.mjs$/,
      loader: path.resolve(__dirname, "webpack-loaders/pdfjs-patch-loader.js"),
    });

    return config;
  },

  // CSP headers — mirrors the Traefik middleware policy in docker-compose.prod.yml
  // so violations surface in dev instead of only in production.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://cdn.jsdelivr.net",
      "connect-src 'self' https://cdn.jsdelivr.net",
      "worker-src blob:",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
    ];
  },

  // Proxy /media/* → Garage so media URLs work in dev and production.
  // Traefik passes all traffic through to the web service, so Next.js
  // handles this rewrite directly in production.
  //
  // The target is Garage's web endpoint (3902), not its S3 API (3900): the
  // S3 API never answers unauthenticated requests. The web endpoint picks the
  // bucket from the Host header, and Next's proxy sets Host to the target's,
  // so the hostname here must be the bucket name — the garage container
  // carries it as a network alias in both compose files.
  //
  // This is evaluated at build time and baked into the production image, so
  // the default below is what production actually runs.
  async rewrites() {
    const mediaOrigin = process.env.MEDIA_ORIGIN || "http://kuara-media:3902";
    return [
      {
        source: "/media/:path*",
        destination: `${mediaOrigin}/:path*`,
        // Existing media URLs are stored unprefixed in the database
        // (see payload.config.ts generateFileURL) — keep matching them
        // as-is regardless of basePath, instead of requiring a migration.
        basePath: false,
      },
    ];
  },
};

export default withPayload(nextConfig);
