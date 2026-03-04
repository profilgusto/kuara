'use client'

import React, { useCallback, useRef } from 'react'
import { useField } from '@payloadcms/ui'
import Editor, { type Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'


/* ──────────────────────────────────────
   Snippet Definitions
   ──────────────────────────────────── */
interface Snippet {
    label: string
    icon: string
    template: string
    description: string
    /** category for grouping in the toolbar */
    category: 'structure' | 'media' | 'presentation' | 'content'
}

const SNIPPETS: Snippet[] = [
    // ── Structure ──
    {
        label: 'Título H1',
        icon: 'H1',
        template: '# ${1:Título}\n\n',
        description: 'Cabeçalho principal',
        category: 'structure',
    },
    {
        label: 'Título H2',
        icon: 'H2',
        template: '## ${1:Subtítulo}\n\n',
        description: 'Subcabeçalho (aparece na barra lateral)',
        category: 'structure',
    },
    {
        label: 'Título H3',
        icon: 'H3',
        template: '### ${1:Seção}\n\n',
        description: 'Seção menor',
        category: 'structure',
    },
    {
        label: 'Divisor (hr)',
        icon: '—',
        template: '\n---\n\n',
        description: 'Linha divisória horizontal',
        category: 'structure',
    },

    // ── Content ──
    {
        label: 'Negrito',
        icon: 'B',
        template: '**${1:texto}**',
        description: 'Texto em negrito',
        category: 'content',
    },
    {
        label: 'Itálico',
        icon: 'I',
        template: '*${1:texto}*',
        description: 'Texto em itálico',
        category: 'content',
    },
    {
        label: 'Lista',
        icon: '☰',
        template: '- ${1:Item 1}\n- ${2:Item 2}\n- ${3:Item 3}\n',
        description: 'Lista com marcadores',
        category: 'content',
    },
    {
        label: 'Equação',
        icon: '∑',
        template: '$$\n${1:\\\\frac{a}{b}}\n$$\n',
        description: 'Bloco de equação matemática (LaTeX)',
        category: 'content',
    },
    {
        label: 'Equação Inline',
        icon: 'π',
        template: '$${1:E = mc^2}$',
        description: 'Equação inline no texto',
        category: 'content',
    },
    {
        label: 'Código',
        icon: '</>',
        template: '```${1:python}\n${2:# seu código aqui}\n```\n',
        description: 'Bloco de código com syntax highlight',
        category: 'content',
    },
    {
        label: 'Callout',
        icon: '💡',
        template: '<Callout type="${1|info,warning,danger|}">\n${2:Conteúdo do callout}\n</Callout>\n',
        description: 'Caixa de destaque (info, warning, danger)',
        category: 'content',
    },
    {
        label: 'Link',
        icon: '🔗',
        template: '[${1:texto do link}](${2:https://})',
        description: 'Hyperlink',
        category: 'content',
    },
    {
        label: 'Imagem',
        icon: '🖼',
        template: '![${1:descrição}](${2:url-da-imagem})\n',
        description: 'Inserir imagem',
        category: 'content',
    },

    // ── Media ──
    {
        label: 'YouTube',
        icon: '▶',
        template: '<YouTube url="${1:https://youtu.be/VIDEO_ID}" />\n',
        description: 'Embed de vídeo do YouTube',
        category: 'media',
    },
    {
        label: 'PDF',
        icon: '📄',
        template: '<PDF url="${1:/caminho/do/arquivo.pdf}" />\n',
        description: 'Embed de PDF',
        category: 'media',
    },

    // ── Presentation ──
    {
        label: 'Slide',
        icon: '🖥',
        template: '---\n\n<Slide>\n\n${1:Conteúdo do slide}\n\n</Slide>\n\n',
        description: 'Novo slide (separado por ---)',
        category: 'presentation',
    },
    {
        label: 'TextOnly',
        icon: '📝',
        template: '<TextOnly>\n\n${1:Conteúdo visível apenas na versão texto}\n\n</TextOnly>\n',
        description: 'Conteúdo exibido apenas na versão texto (não em slides)',
        category: 'presentation',
    },
    {
        label: 'PresentOnly',
        icon: '📊',
        template: '<PresentOnly>\n\n${1:Conteúdo visível apenas na apresentação}\n\n</PresentOnly>\n',
        description: 'Conteúdo exibido apenas na versão apresentação',
        category: 'presentation',
    },
]

const CATEGORY_LABELS: Record<Snippet['category'], string> = {
    structure: 'Estrutura',
    content: 'Conteúdo',
    media: 'Mídia',
    presentation: 'Apresentação',
}

const CATEGORY_ORDER: Snippet['category'][] = ['structure', 'content', 'media', 'presentation']

/* ──────────────────────────────────────
   Component
   ──────────────────────────────────── */

interface MonacoMDXFieldProps {
    path: string
    field: {
        name: string
        label?: string | Record<string, string>
        admin?: {
            description?: string
        }
    }
}

export const MonacoMDXField: React.FC<MonacoMDXFieldProps> = ({ path, field }) => {
    const { value, setValue } = useField<string>({ path })
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
    const monacoRef = useRef<Monaco | null>(null)


    const handleEditorMount = useCallback(
        (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
            editorRef.current = editorInstance
            monacoRef.current = monaco

            // Register MDX-flavored snippets as Monaco suggestions
            monaco.languages.registerCompletionItemProvider('markdown', {
                provideCompletionItems: (model: editor.ITextModel, position: any) => {
                    const word = model.getWordUntilPosition(position)
                    const range = {
                        startLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endLineNumber: position.lineNumber,
                        endColumn: word.endColumn,
                    }

                    const suggestions = SNIPPETS.map((s) => ({
                        label: s.label,
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        documentation: s.description,
                        insertText: s.template,
                        insertTextRules:
                            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        range,
                    }))

                    return { suggestions }
                },
                triggerCharacters: ['<', '/', '#', '$'],
            })
        },
        []
    )

    const insertSnippet = useCallback((template: string) => {
        const editor = editorRef.current
        if (!editor) return

        editor.focus()
        const selection = editor.getSelection()
        if (!selection) return

        // Find selected text (to wrap in a snippet if applicable)
        const selectedText = editor.getModel()?.getValueInRange(selection) || ''

        // Replace ${1:...} placeholders — use selected text as first placeholder value
        let finalText = template
        if (selectedText) {
            finalText = finalText.replace(/\$\{1:[^}]*\}/, selectedText)
        } else {
            // Remove placeholder markers but keep default text
            finalText = finalText.replace(/\$\{(\d+)\|([^}]*)\}/g, '$2')
            finalText = finalText.replace(/\$\{(\d+):([^}]*)\}/g, '$2')
        }

        // Execute an edit operation so it goes onto the undo stack
        editor.executeEdits('snippet', [
            {
                range: selection,
                text: finalText,
                forceMoveMarkers: true,
            },
        ])

        // Trigger autosave by updating the Payload field value
        const newValue = editor.getModel()?.getValue() || ''
        setValue(newValue)
    }, [setValue])

    const handleChange = useCallback(
        (newValue: string | undefined) => {
            setValue(newValue ?? '')
        },
        [setValue]
    )

    // Group snippets by category
    const groupedSnippets = CATEGORY_ORDER.map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        items: SNIPPETS.filter((s) => s.category === cat),
    }))

    const fieldLabel =
        typeof field.label === 'string'
            ? field.label
            : typeof field.label === 'object'
                ? Object.values(field.label)[0]
                : field.name

    return (
        <div className="field-type textarea" style={{ marginBottom: '24px' }}>
            {/* Label */}
            <label
                className="field-label"
                style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                }}
            >
                {fieldLabel}
            </label>

            {/* Snippet Toolbar */}
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '2px',
                    padding: '6px 8px',
                    background: '#1e1e1e',
                    borderRadius: '8px 8px 0 0',
                    borderBottom: '1px solid #333',
                    alignItems: 'center',
                }}
            >
                {groupedSnippets.map((group, gi) => (
                    <React.Fragment key={group.category}>
                        {gi > 0 && (
                            <div
                                style={{
                                    width: '1px',
                                    height: '24px',
                                    background: '#444',
                                    margin: '0 6px',
                                }}
                            />
                        )}
                        <span
                            style={{
                                fontSize: '10px',
                                color: '#888',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginRight: '4px',
                                userSelect: 'none',
                            }}
                        >
                            {group.label}
                        </span>
                        {group.items.map((snippet) => (
                            <button
                                key={snippet.label}
                                type="button"
                                title={`${snippet.label}: ${snippet.description}`}
                                onClick={() => insertSnippet(snippet.template)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '32px',
                                    height: '28px',
                                    padding: '0 8px',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    background: '#2d2d2d',
                                    color: '#ccc',
                                    border: '1px solid #444',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#3a3d41'
                                    e.currentTarget.style.color = '#fff'
                                    e.currentTarget.style.borderColor = '#5a8'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#2d2d2d'
                                    e.currentTarget.style.color = '#ccc'
                                    e.currentTarget.style.borderColor = '#444'
                                }}
                            >
                                {snippet.icon}
                            </button>
                        ))}
                    </React.Fragment>
                ))}
            </div>

            {/* Monaco Editor */}
            <div
                style={{
                    border: '1px solid #333',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    overflow: 'hidden',
                }}
            >
                <Editor
                    height="60vh"
                    defaultLanguage="markdown"
                    theme="vs-dark"
                    value={value || ''}
                    onChange={handleChange}
                    onMount={handleEditorMount}
                    options={{
                        fontSize: 14,
                        fontFamily: "'IBM Plex Mono', 'Fira Code', Menlo, monospace",
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        renderLineHighlight: 'line',
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        padding: { top: 12, bottom: 12 },
                        suggest: {
                            showSnippets: true,
                            snippetsPreventQuickSuggestions: false,
                        },
                        tabSize: 2,
                        bracketPairColorization: { enabled: true },
                        autoClosingBrackets: 'always',
                        autoClosingQuotes: 'always',
                        formatOnPaste: false,
                        quickSuggestions: {
                            other: true,
                            comments: false,
                            strings: false,
                        },
                    }}
                />
            </div>

            {/* Description */}
            {field.admin?.description && (
                <div
                    style={{
                        marginTop: '6px',
                        fontSize: '12px',
                        color: '#888',
                    }}
                >
                    {field.admin.description}
                </div>
            )}
        </div>
    )
}

export default MonacoMDXField
