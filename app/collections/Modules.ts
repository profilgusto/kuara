import type { CollectionConfig } from 'payload'
import { syncModuleMediaRefs, cleanModuleMediaRefs } from '@/hooks/syncMediaUsedIn'

export const Modules: CollectionConfig = {
    slug: 'modules',
    folders: true,
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'type', 'course', 'order', '_status'],
        livePreview: {
            url: ({ data }) => {
                return `http://localhost:3000/preview/modules/${data.id}`
            },
        },
        components: {
            edit: {
                SaveDraftButton: '@/admin/components/SaveDraftButton',
                PublishButton: '@/admin/components/CustomPublishButton',
            },
        },
    },
    access: {
        // Public read requires item to be published (unless admin)
        read: ({ req: { user } }) => {
            if (user?.role === 'admin' || user?.role === 'professor') return true
            return {
                _status: {
                    equals: 'published',
                },
            }
        },
        create: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
        update: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
        delete: ({ req: { user } }) => user?.role === 'admin',
    },
    hooks: {
        afterChange: [syncModuleMediaRefs],
        afterDelete: [cleanModuleMediaRefs],
    },
    versions: {
        drafts: {
            autosave: {
                showSaveDraftButton: true,
                interval: 300000, // 5 minutes in milliseconds
            },
        },
        maxPerDoc: 50, // Keep last 50 versions to avoid history bloat
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
                description: 'Conteúdo MDX do módulo. Use a toolbar ou Ctrl+Espaço para inserir snippets.',
                components: {
                    Field: '@/admin/components/MonacoMDXField',
                },
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
