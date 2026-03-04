import type { CollectionConfig } from 'payload'

export const Scores: CollectionConfig = {
    slug: 'scores',
    admin: {
        defaultColumns: ['activity', 'entityType', 'student', 'group', 'percentage'],
    },
    access: {
        read: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin' || user.role === 'professor') return true
            // Students can only see their own scores
            return {
                or: [
                    { student: { equals: user.id } },
                    // Also allow if the student is in the scored group
                ],
            }
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
            name: 'offer',
            type: 'relationship',
            relationTo: 'offers',
            required: true,
        },
        {
            name: 'activity',
            type: 'relationship',
            relationTo: 'activities',
            required: true,
        },
        {
            name: 'entityType',
            type: 'select',
            required: true,
            options: [
                { label: 'Student', value: 'student' },
                { label: 'Group', value: 'group' },
            ],
            admin: {
                description: 'Whether this score is for an individual student or a group',
            },
        },
        {
            name: 'student',
            type: 'relationship',
            relationTo: 'users',
            admin: {
                description: 'The student (if entityType is student)',
                condition: (data) => data?.entityType === 'student',
            },
        },
        {
            name: 'group',
            type: 'relationship',
            relationTo: 'student-groups',
            admin: {
                description: 'The group (if entityType is group)',
                condition: (data) => data?.entityType === 'group',
            },
        },
        {
            name: 'percentage',
            type: 'number',
            required: true,
            min: 0,
            max: 100,
            admin: {
                description: 'Score from 0% to 100%',
                step: 0.1,
            },
        },
    ],
}
