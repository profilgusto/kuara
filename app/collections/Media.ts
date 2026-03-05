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
        defaultColumns: ['alt', 'usedIn', 'filename', 'mimeType', 'filesize'],
        listSearchableFields: ['alt', 'filename'],
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
            required: true,
            admin: {
                description: 'Alternative text for accessibility',
            },
        },
        {
            name: 'usedIn',
            type: 'relationship',
            relationTo: ['modules', 'posts', 'courses', 'activities'],
            hasMany: true,
            admin: {
                description: 'Vincule esta mídia a módulos, posts ou cursos para melhor organização.',
                position: 'sidebar',
            },
            index: true,
        },
    ],
}
