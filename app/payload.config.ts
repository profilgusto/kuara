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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
    admin: {
        user: Users.slug,
        importMap: {
            baseDir: path.resolve(dirname),
        },
    },
    collections: [Users, Courses, Modules, Offers, Posts, Media],
    editor: lexicalEditor(),
    secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME-IN-PRODUCTION',
    typescript: {
        outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
    db: postgresAdapter({
        push: true,
        pool: {
            connectionString: process.env.DATABASE_URL || '',
        },
    }),
})
