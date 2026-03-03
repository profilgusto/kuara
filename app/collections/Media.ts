import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
    slug: 'media',
    upload: {
        mimeTypes: [
            'image/*',
            'application/pdf',
            'video/*',
            'audio/*',
        ],
    },
    admin: {
        useAsTitle: 'alt',
    },
    access: {
        // Public read
        read: () => true,
        create: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
        update: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
        delete: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
    },
    fields: [
        {
            name: 'alt',
            type: 'text',
            admin: {
                description: 'Alternative text for accessibility',
            },
        },
    ],
}
