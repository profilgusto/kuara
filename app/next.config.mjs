import { withPayload } from '@payloadcms/next/withPayload'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",

    // react-pdf ships ESM-only; include it in Next.js's SWC transform pass.
    transpilePackages: ['react-pdf'],

    // citation-js packages use dynamic requires — keep them as Node.js externals
    // so Next.js does not attempt to bundle them for the client.
    serverExternalPackages: [
        '@citation-js/core',
        '@citation-js/plugin-bibtex',
        '@citation-js/plugin-csl',
    ],

    webpack: (config) => {
        // pdfjs-dist tries to import 'canvas' in Node environments — alias it away
        config.resolve.alias.canvas = false

        // pdf.mjs is itself a webpack bundle (it embeds its own webpack runtime).
        // Next.js's webpack recognises "__webpack_exports__" and "__webpack_require__"
        // as reserved identifiers and replaces/freezes them, which causes
        // "Object.defineProperty called on non-object" when the inner runtime tries
        // to define exports on the frozen object.
        // Our custom loader renames those variables before webpack sees the file.
        config.module.rules.push({
            test: /pdfjs-dist[\\/]build[\\/]pdf\.mjs$/,
            loader: path.resolve(__dirname, 'webpack-loaders/pdfjs-patch-loader.js'),
        })

        return config
    },

    // Proxy /media/* → MinIO so media URLs work without Nginx (dev) and as a
    // fallback in production (Nginx intercepts first, so this never fires there).
    async rewrites() {
        const s3Endpoint = process.env.S3_ENDPOINT || 'http://minio:9000'
        const s3Bucket = process.env.S3_BUCKET || 'kuara-media'
        return [
            {
                source: '/media/:path*',
                destination: `${s3Endpoint}/${s3Bucket}/:path*`,
            },
        ]
    },
};

export default withPayload(nextConfig);
