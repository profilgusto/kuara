import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",

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
