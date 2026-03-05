import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
    slug: 'media',
    upload: {
        mimeTypes: [
            'image/*',
            'application/pdf',
            'video/*',
            'audio/*',
            'application/zip',
            'application/x-zip-compressed',
        ],
    },
    admin: {
        useAsTitle: 'alt',
        defaultColumns: ['alt', 'category', 'filename', 'mimeType', 'filesize'],
        listSearchableFields: ['alt', 'category', 'filename'],
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
        {
            name: 'category',
            type: 'text',
            admin: {
                description: 'Categorize this media (e.g., Module 1, Post X, etc.)',
                position: 'sidebar',
            },
            index: true,
        },
    ],
}
