import type { CollectionConfig } from 'payload'

export const Modules: CollectionConfig = {
    slug: 'modules',
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'type', 'course', 'order', 'visible'],
    },
    access: {
        // Public read - anyone can see module content
        read: () => true,
        create: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
        update: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
        delete: ({ req: { user } }) => user?.role === 'admin',
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            admin: {
                description: 'URL-friendly identifier (e.g., mt01-introducao)',
            },
        },
        {
            name: 'type',
            type: 'select',
            required: true,
            options: [
                { label: 'Módulo Teórico', value: 'modulo-teorico' },
                { label: 'Módulo Prático', value: 'modulo-pratico' },
                { label: 'Atividade Avaliativa', value: 'atividade-avaliativa' },
                { label: 'Recurso', value: 'recurso' },
            ],
        },
        {
            name: 'course',
            type: 'relationship',
            relationTo: 'courses',
            required: true,
            admin: {
                description: 'Parent course this module belongs to',
            },
        },
        {
            name: 'content',
            type: 'textarea',
            admin: {
                description: 'Raw MDX content for this module',
                rows: 30,
            },
        },
        {
            name: 'order',
            type: 'number',
            required: true,
            defaultValue: 0,
            admin: {
                description: 'Sort order within the course',
            },
        },
        {
            name: 'visible',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Whether this module is visible to students',
            },
        },
    ],
}
