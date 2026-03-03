'use client'
import { ReactNode } from 'react'
import { Info, AlertTriangle, Lightbulb } from 'lucide-react'

type CalloutType = 'note' | 'warning' | 'tip'

interface CalloutProps {
    type?: CalloutType
    children: ReactNode
}

const config: Record<CalloutType, { icon: typeof Info; label: string; colors: string }> = {
    note: {
        icon: Info,
        label: 'Nota',
        colors: 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200',
    },
    warning: {
        icon: AlertTriangle,
        label: 'Atenção',
        colors: 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200',
    },
    tip: {
        icon: Lightbulb,
        label: 'Dica',
        colors: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200',
    },
}

export default function Callout({ type = 'note', children }: CalloutProps) {
    const { icon: Icon, label, colors } = config[type] || config.note

    return (
        <div className={`my-6 rounded-lg border-l-4 p-4 ${colors}`}>
            <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
            </div>
            <div className="text-sm [&>p]:my-1">{children}</div>
        </div>
    )
}
