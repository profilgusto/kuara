'use client'

import React, { useState, useEffect } from 'react'
import { useDocumentInfo, useConfig } from '@payloadcms/ui'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ModuleItem {
    id: string
    title: string
    type: string
    order: number
    visible: boolean
    slug: string
}

const TYPE_LABELS: Record<string, string> = {
    'modulo-teorico': 'Teórico',
    'modulo-pratico': 'Prático',
    'atividade-avaliativa': 'Avaliativo',
    recurso: 'Recurso',
}

const TYPE_COLORS: Record<string, string> = {
    'modulo-teorico': '#2FA8B8',
    'modulo-pratico': '#3FAF5C',
    'atividade-avaliativa': '#A56E4A',
    recurso: '#4F5A55',
}

interface SortableItemProps {
    module: ModuleItem
    index: number
}

const SortableItem: React.FC<SortableItemProps> = ({ module, index }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: module.id,
    })

    const typeColor = TYPE_COLORS[module.type] || '#888'

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                marginBottom: '8px',
                background: isDragging
                    ? 'var(--theme-elevation-200, #2a2a2a)'
                    : 'var(--theme-elevation-100, #1a1a1a)',
                border: `1px solid ${isDragging ? 'var(--theme-elevation-500, #666)' : 'var(--theme-elevation-300, #3a3a3a)'}`,
                borderRadius: '6px',
                opacity: isDragging ? 0.85 : 1,
                boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
                userSelect: 'none',
            }}
        >
            {/* Drag handle */}
            <div
                {...attributes}
                {...listeners}
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    color: 'var(--theme-elevation-500, #888)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '4px',
                    flexShrink: 0,
                }}
                title="Arrastar para reordenar"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="5" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="9" cy="19" r="1.5" />
                    <circle cx="15" cy="5" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="15" cy="19" r="1.5" />
                </svg>
            </div>

            {/* Order badge */}
            <div
                style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--theme-elevation-200, #333)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--theme-elevation-800, #ccc)',
                    flexShrink: 0,
                }}
            >
                {index + 1}
            </div>

            {/* Title + slug */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--theme-elevation-1000, #fff)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {module.title}
                </div>
                <div
                    style={{
                        fontSize: '12px',
                        color: 'var(--theme-elevation-500, #888)',
                        marginTop: '2px',
                        fontFamily: 'monospace',
                    }}
                >
                    {module.slug}
                </div>
            </div>

            {/* Type badge */}
            <div
                style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: `${typeColor}22`,
                    color: typeColor,
                    border: `1px solid ${typeColor}44`,
                    flexShrink: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                }}
            >
                {TYPE_LABELS[module.type] || module.type}
            </div>

            {/* Hidden indicator */}
            {!module.visible && (
                <div
                    title="Oculto para alunos"
                    style={{ color: 'var(--theme-elevation-400, #666)', flexShrink: 0 }}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                </div>
            )}
        </div>
    )
}

export const ModuleReorderView: React.FC = () => {
    const { id: courseId } = useDocumentInfo()
    const {
        config: {
            routes: { api },
        },
    } = useConfig()

    const [modules, setModules] = useState<ModuleItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
    const [hasChanges, setHasChanges] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    useEffect(() => {
        if (!courseId) return
        setLoading(true)
        fetch(
            `${api}/modules?where[course][equals]=${courseId}&sort=order&depth=0&limit=100`,
            { credentials: 'include' },
        )
            .then((r) => r.json())
            .then((data) => {
                setModules(data.docs || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [courseId, api])

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setModules((prev) => {
            const oldIndex = prev.findIndex((m) => m.id === active.id)
            const newIndex = prev.findIndex((m) => m.id === over.id)
            return arrayMove(prev, oldIndex, newIndex)
        })
        setHasChanges(true)
        setSaveStatus('idle')
    }

    const saveOrder = async () => {
        setSaving(true)
        setSaveStatus('idle')
        try {
            await Promise.all(
                modules.map((module, index) =>
                    fetch(`${api}/modules/${module.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ order: index + 1 }),
                    }),
                ),
            )
            setHasChanges(false)
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus('idle'), 3000)
        } catch {
            setSaveStatus('error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div
                style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--theme-elevation-500, #888)',
                }}
            >
                Carregando módulos...
            </div>
        )
    }

    if (!courseId) {
        return (
            <div
                style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--theme-elevation-500, #888)',
                }}
            >
                Salve a disciplina antes de ordenar os módulos.
            </div>
        )
    }

    if (modules.length === 0) {
        return (
            <div
                style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--theme-elevation-500, #888)',
                }}
            >
                Nenhum módulo encontrado para esta disciplina.
            </div>
        )
    }

    return (
        <div style={{ padding: '32px', maxWidth: '800px' }}>
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '24px',
                    gap: '16px',
                }}
            >
                <div>
                    <h2
                        style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: 'var(--theme-elevation-1000, #fff)',
                            margin: 0,
                        }}
                    >
                        Ordenar Módulos
                    </h2>
                    <p
                        style={{
                            fontSize: '13px',
                            color: 'var(--theme-elevation-500, #888)',
                            margin: '4px 0 0',
                        }}
                    >
                        Arraste os módulos para definir a ordem de exibição na disciplina.
                    </p>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexShrink: 0,
                    }}
                >
                    {saveStatus === 'saved' && (
                        <span style={{ fontSize: '13px', color: '#3FAF5C' }}>
                            ✓ Ordem salva
                        </span>
                    )}
                    {saveStatus === 'error' && (
                        <span style={{ fontSize: '13px', color: '#e57373' }}>
                            Erro ao salvar. Tente novamente.
                        </span>
                    )}
                    <button
                        onClick={() => void saveOrder()}
                        disabled={saving || !hasChanges}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 18px',
                            fontSize: '13px',
                            fontWeight: 500,
                            fontFamily: 'inherit',
                            borderRadius: '4px',
                            border: hasChanges
                                ? '1px solid #3FAF5C'
                                : '1px solid var(--theme-elevation-400, #555)',
                            background: hasChanges
                                ? 'rgba(63,175,92,0.12)'
                                : 'var(--theme-elevation-100, #222)',
                            color: hasChanges ? '#3FAF5C' : 'var(--theme-elevation-500, #888)',
                            cursor: saving || !hasChanges ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {saving ? 'Salvando...' : 'Salvar Ordem'}
                    </button>
                </div>
            </div>

            {/* Count */}
            <div
                style={{
                    fontSize: '12px',
                    color: 'var(--theme-elevation-500, #888)',
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--theme-elevation-200, #333)',
                }}
            >
                {modules.length} módulo{modules.length !== 1 ? 's' : ''}
            </div>

            {/* Sortable list */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={modules.map((m) => m.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {modules.map((module, index) => (
                        <SortableItem key={module.id} module={module} index={index} />
                    ))}
                </SortableContext>
            </DndContext>
        </div>
    )
}

export default ModuleReorderView
