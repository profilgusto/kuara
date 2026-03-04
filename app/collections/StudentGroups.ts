import type { CollectionConfig } from 'payload'

export const StudentGroups: CollectionConfig = {
    slug: 'student-groups',
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'offer'],
    },
    access: {
        read: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin' || user.role === 'professor') return true
            // Students can read groups they belong to
            return true
        },
        create: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
        update: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
        delete: ({ req: { user } }) =>
            user?.role === 'admin' || user?.role === 'professor',
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Group name (e.g., Grupo 1, Equipe Alpha)',
            },
        },
        {
            name: 'offer',
            type: 'relationship',
            relationTo: 'offers',
            required: true,
        },
        {
            name: 'students',
            type: 'relationship',
            relationTo: 'users',
            hasMany: true,
            admin: {
                description: 'Students assigned to this group',
            },
        },
    ],
}
