import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Courses } from './collections/Courses'
import { Modules } from './collections/Modules'
import { Offers } from './collections/Offers'
import { Posts } from './collections/Posts'
import { Media } from './collections/Media'
import { Activities } from './collections/Activities'
import { StudentGroups } from './collections/StudentGroups'
import { Scores } from './collections/Scores'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
    admin: {
        user: Users.slug,
        importMap: {
            baseDir: path.resolve(dirname),
        },
    },
    collections: [Users, Courses, Modules, Offers, Posts, Media, Activities, StudentGroups, Scores],
    editor: lexicalEditor(),
    secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME-IN-PRODUCTION',
    typescript: {
        outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
    db: postgresAdapter({
        // push:true is convenient in dev (auto-syncs schema on startup).
        // In production (NODE_ENV=production) it is disabled — use explicit
        // migrations instead: npx payload migrate:create → npx payload migrate.
        push: process.env.NODE_ENV !== 'production',
        migrationDir: path.resolve(dirname, 'migrations'),
        pool: {
            connectionString: process.env.DATABASE_URL || '',
        },
    }),
})
