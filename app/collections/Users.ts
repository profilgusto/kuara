import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
    slug: 'users',
    auth: true,
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'email', 'role'],
    },
    access: {
        // Admin can read all; students can only read themselves
        read: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin' || user.role === 'professor') return true
            return { id: { equals: user.id } }
        },
        // Only admin can create users
        create: ({ req: { user } }) => user?.role === 'admin',
        // Admin can update all; users can update themselves
        update: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin') return true
            return { id: { equals: user.id } }
        },
        // Only admin can delete
        delete: ({ req: { user } }) => user?.role === 'admin',
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
        },
        {
            name: 'role',
            type: 'select',
            required: true,
            defaultValue: 'student',
            options: [
                { label: 'Admin', value: 'admin' },
                { label: 'Professor', value: 'professor' },
                { label: 'Student', value: 'student' },
            ],
            access: {
                // Only admin can change roles
                update: ({ req: { user } }) => user?.role === 'admin',
            },
        },
    ],
}
