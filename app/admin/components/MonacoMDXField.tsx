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
        template: '# ${1:Título do Conteúdo}\n\n',
        description: 'Cabeçalho principal (Título)',
        category: 'structure',
    },
    {
        label: 'Título H2',
        icon: 'H2',
        template: '## ${1:Subtítulo da Seção}\n\n',
        description: 'Título de nível 2 (aparece no índice)',
        category: 'structure',
    },
    {
        label: 'Título H3',
        icon: 'H3',
        template: '### ${1:Nome da Subseção}\n\n',
        description: 'Título de nível 3',
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
        template: '**${1:texto importante}**',
        description: 'Texto em negrito',
        category: 'content',
    },
    {
        label: 'Itálico',
        icon: 'I',
        template: '*${1:ênfase}*',
        description: 'Texto em itálico',
        category: 'content',
    },
    {
        label: 'Riscado',
        icon: 'S',
        template: '~~${1:texto removido}~~',
        description: 'Texto tachado (GFM)',
        category: 'content',
    },
    {
        label: 'Lista',
        icon: '☰',
        template: '- ${1:Primeiro item}\n- ${2:Segundo item}\n- ${3:Terceiro item}\n',
        description: 'Lista com marcadores',
        category: 'content',
    },
    {
        label: 'Checklist',
        icon: '☑',
        template: '- [ ] ${1:Tarefa pendente}\n- [x] ${2:Tarefa concluída}\n',
        description: 'Lista de tarefas (GFM)',
        category: 'content',
    },
    {
        label: 'Tabela',
        icon: '田',
        template: '| ${1:Coluna 1} | ${2:Coluna 2} |\n| :--- | :--- |\n| ${3:Dado A} | ${4:Dado B} |\n| ${5:Dado C} | ${6:Dado D} |\n',
        description: 'Tabela formatada (GFM)',
        category: 'content',
    },
    {
        label: 'Link',
        icon: '🔗',
        template: '[${1:texto do link}](${2:https://exemplo.com})',
        description: 'Link inline padrão',
        category: 'content',
    },
    {
        label: 'Link Externo (Destaque)',
        icon: '↗',
        template: '<ExternalLink\n  url="${1:https://}"\n  title="${2:Título do Link}"\n  description="${3:Breve descrição do destino}"\n/>\n',
        description: 'Banner de link externo estilizado',
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
        description: 'Equação inline no meio do texto',
        category: 'content',
    },
    {
        label: 'Equação Numerada',
        icon: '∑#',
        template: '$$\n\\begin{equation}\n  ${1:E = mc^2} \\label{eq:${2:referencia}}\n\\end{equation}\n$$\n',
        description: 'Equação com numeração automática e label para referência (AMS)',
        category: 'content',
    },
    {
        label: 'Ref. Equação',
        icon: '(1)',
        template: '$\\eqref{eq:${1:referencia}}$',
        description: 'Cria hiperlink referenciando uma equação numerada',
        category: 'content',
    },
    {
        label: 'Código',
        icon: '</>',
        template: '```${1|python,javascript,typescript,css,html,json,bash|}\n${2:# insira seu código aqui}\n```\n',
        description: 'Bloco de código com destaque de sintaxe',
        category: 'content',
    },
    {
        label: 'Callout',
        icon: '💡',
        template: '<Callout type="${1|info,warning,danger,tip|}">\n${2:Conteúdo ou aviso importante}\n</Callout>\n',
        description: 'Caixa de aviso (info, warning, danger, tip)',
        category: 'content',
    },

    // ── Media ──
    {
        label: 'Imagem',
        icon: '🖼',
        template: '<KImage\n  url="${1:/api/media/file/nome-do-arquivo.png}"\n  width="${2:400}"\n  widthPresentation="${3:600}"\n  align="${4|center,left,right|}"\n  alt="${5:descrição da imagem}"\n/>\n',
        description: 'Imagem customizada com controle de tamanho e alinhamento',
        category: 'media',
    },
    {
        label: 'YouTube',
        icon: '▶',
        template: '<YouTube\n  url="${1:https://youtu.be/ID_DO_VIDEO}"\n  start={${2:0}}\n  title="${3:Título do Vídeo}"\n/>\n',
        description: 'Incorporar vídeo do YouTube (URL ou ID)',
        category: 'media',
    },
    {
        label: 'PDF',
        icon: '📄',
        template: '<PDF\n  url="${1:/api/media/file/documento.pdf}"\n  title="${2:Título do PDF}"\n/>\n',
        description: 'Visualizador de PDF incorporado',
        category: 'media',
    },
    {
        label: 'Download',
        icon: '⬇',
        template: '<Download\n  url="${1:/api/media/file/arquivo.zip}"\n  label="${2:Baixar Material Complementar}"\n  filename="${3:material.zip}"\n/>\n',
        description: 'Banner para download de arquivos genéricos',
        category: 'media',
    },

    // ── Presentation (Slides) ──
    {
        label: 'Novo Slide',
        icon: '🖥',
        template: '---\n\n<Slide>\n\n${1:## Título do Slide}\n\n${2:Conteúdo do slide...}\n\n</Slide>\n\n',
        description: 'Cria um novo slide na apresentação',
        category: 'presentation',
    },
    {
        label: 'Apenas Texto',
        icon: '📝',
        template: '<TextOnly>\n\n${1:Este conteúdo aparece apenas na leitura (não nos slides)}\n\n</TextOnly>\n',
        description: 'Conteúdo oculto na visualização de slides',
        category: 'presentation',
    },
    {
        label: 'Apenas Slides',
        icon: '📊',
        template: '<PresentOnly>\n\n${1:Este conteúdo aparece apenas nos slides (não na leitura)}\n\n</PresentOnly>\n',
        description: 'Conteúdo oculto na visualização de texto corrido',
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

    // Intercept and disable Cmd+S / Ctrl+S
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                e.stopPropagation()
                console.log('Cmd+S intercepted and disabled.')
            }
        }
        window.addEventListener('keydown', handleKeyDown, true) // useCapture=true to catch it first
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [])

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
