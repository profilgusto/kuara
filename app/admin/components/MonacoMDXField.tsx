"use client";

import React, { useCallback, useRef } from "react";
import { useField } from "@payloadcms/ui";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Minus,
  ImagePlus,
  Link2,
  Video,
  FileText,
  ArrowDownToLine,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Code2,
  Presentation,
  Columns2,
  Lightbulb,
  ExternalLink as ExternalLinkIcon,
  List,
  Quote,
  Maximize,
  CheckSquare,
  Table,
  Sigma,
  Pi,
  Hash,
  TextCursorInput,
  AlignLeft,
  Monitor,
  CornerDownRight,
  BookMarked,
  MessageSquareDashed,
  ListTodo,
  Dumbbell,
  BookOpen,
  Brain,
  BookText,
  Check,
} from "lucide-react";

// ── Snippet categories include 'citations' now ──
// Assuming Button component is available or imported from a UI library like shadcn/ui
// If not, you'd need to define it or import it. For this task, I'll assume it's available.
// import { Button } from '@/components/ui/button' // Example import path

/* ──────────────────────────────────────
   Snippet Definitions
   ──────────────────────────────────── */
interface Snippet {
  label: string;
  icon: React.ElementType | string; // Changed to allow Lucide icons or string
  template: string;
  description: string;
  /** category for grouping in the toolbar */
  category: "structure" | "media" | "presentation" | "content" | "citations" | "figures" | "questions" | "authoring";
}

const SNIPPETS: Snippet[] = [
  // ── Structure ──
  {
    label: "Título H1",
    icon: Heading1,
    template: "# ${1:Título do Conteúdo}\n\n",
    description: "Cabeçalho principal (Título)",
    category: "structure",
  },
  {
    label: "Título H2",
    icon: Heading2,
    template: "## ${1:Subtítulo da Seção}\n\n",
    description: "Título de nível 2 (aparece no índice)",
    category: "structure",
  },
  {
    label: "Título H3",
    icon: Heading3,
    template: "### ${1:Nome da Subseção}\n\n",
    description: "Título de nível 3",
    category: "structure",
  },
  {
    label: "Divisor (hr)",
    icon: Minus,
    template: "\n---\n\n",
    description: "Linha divisória horizontal",
    category: "structure",
  },

  // ── Content ──
  {
    label: "Negrito",
    icon: Bold,
    template: "**${1:texto importante}**",
    description: "Texto em negrito",
    category: "content",
  },
  {
    label: "Itálico",
    icon: Italic,
    template: "*${1:ênfase}*",
    description: "Texto em itálico",
    category: "content",
  },
  {
    label: "Riscado",
    icon: Strikethrough,
    template: "~~${1:texto removido}~~",
    description: "Texto tachado (GFM)",
    category: "content",
  },
  {
    label: "Lista",
    icon: List,
    template:
      "- ${1:Primeiro item}\n- ${2:Segundo item}\n- ${3:Terceiro item}\n",
    description: "Lista com marcadores",
    category: "content",
  },
  {
    label: "Checklist",
    icon: CheckSquare,
    template: "- [ ] ${1:Tarefa pendente}\n- [x] ${2:Tarefa concluída}\n",
    description: "Lista de tarefas (GFM)",
    category: "content",
  },
  {
    label: "Tabela",
    icon: Table,
    template:
      "| ${1:Coluna 1} | ${2:Coluna 2} |\n| :--- | :--- |\n| ${3:Dado A} | ${4:Dado B} |\n| ${5:Dado C} | ${6:Dado D} |\n",
    description: "Tabela formatada (GFM)",
    category: "content",
  },
  {
    label: "Link",
    icon: LinkIcon,
    template: "[${1:texto do link}](${2:https://exemplo.com})",
    description: "Link inline padrão",
    category: "content",
  },
  {
    label: "Link Externo (Destaque)",
    icon: ExternalLinkIcon,
    template:
      '<ExternalLink\n  url="${1:https://}"\n  title="${2:Título do Link}"\n  description="${3:Breve descrição do destino}"\n/>\n',
    description: "Banner de link externo estilizado",
    category: "content",
  },
  {
    label: "Equação",
    icon: Sigma,
    template: "$$\n${1:\\\\frac{a}{b}}\n$$\n",
    description: "Bloco de equação matemática (LaTeX)",
    category: "content",
  },
  {
    label: "Equação Inline",
    icon: Pi,
    template: "$${1:E = mc^2}$",
    description: "Equação inline no meio do texto",
    category: "content",
  },
  {
    label: "Equação Numerada",
    icon: Hash,
    template:
      "$$\n\\begin{equation}\n  ${1:E = mc^2} \\label{eq:${2:referencia}}\n\\end{equation}\n$$\n",
    description:
      "Equação com numeração automática e label para referência (AMS)",
    category: "content",
  },
  {
    label: "Ref. Equação",
    icon: TextCursorInput, // Using a generic text input icon for now
    template: "$\\eqref{eq:${1:referencia}}$",
    description: "Cria hiperlink referenciando uma equação numerada",
    category: "content",
  },
  {
    label: "Código",
    icon: Code,
    template:
      "```${1|python,javascript,typescript,css,html,json,bash|}\n${2:# insira seu código aqui}\n```\n",
    description: "Bloco de código com destaque de sintaxe",
    category: "content",
  },
  {
    label: "Callout",
    icon: Lightbulb,
    template:
      '<Callout type="${1|info,warning,danger,tip|}">\n${2:Conteúdo ou aviso importante}\n</Callout>\n',
    description: "Caixa de aviso (info, warning, danger, tip)",
    category: "content",
  },

  // ── Figures (numbered) ──
  {
    label: "Figura Simples",
    icon: ImagePlus,
    template:
      '<KImage\n  url="${1:/api/media/file/nome-do-arquivo.png}"\n  width="${2:400}"\n  widthPresentation="${3:auto}"\n/>\n',
    description: "Figura simples sem numeração nem legenda.",
    category: "figures",
  },
  {
    label: "Figura Numerada",
    icon: ImagePlus,
    template:
      '<KImage\n  url="${1:/api/media/file/nome-do-arquivo.png}"\n  label="${2:fig-identificador}"\n  alt="${3:descrição para leitores de tela}"\n  width="${4:400}"\n  widthPresentation="${5:auto}"\n  align="${6:|center,left,right|}"\n>\n  ${7:Legenda da figura}\n</KImage>\n',
    description: 'Figura com numeração automática "Fig. N" e legenda. Requer label único para referências.',
    category: "figures",
  },
  {
    label: "Ref. Figura",
    icon: Link2,
    template: '<RefFig label="${1:fig-identificador}" />',
    description: 'Link inline "Fig. N" que rola até a figura e mostra preview ao hover.',
    category: "figures",
  },
  {
    label: "YouTube",
    icon: Video,
    template:
      '<YouTube\n  url="${1:https://youtu.be/ID_DO_VIDEO}"\n  start={${2:0}}\n  title="${3:Título do Vídeo}"\n/>\n',
    description: "Incorporar vídeo do YouTube (URL ou ID)",
    category: "media",
  },
  {
    label: "PDF",
    icon: FileText,
    template:
      '<PDF\n  url="${1:/api/media/file/documento.pdf}"\n  title="${2:Título do PDF}"\n/>\n',
    description: "Visualizador de PDF incorporado",
    category: "media",
  },
  {
    label: "Download",
    icon: ArrowDownToLine,
    template:
      '<Download\n  url="${1:/api/media/file/arquivo.zip}"\n  label="${2:Baixar Material Complementar}"\n  filename="${3:material.zip}"\n/>\n',
    description: "Banner para download de arquivos genéricos",
    category: "media",
  },

  // ── Citations ──
  {
    label: "Citar",
    icon: BookMarked,
    template: '<Cite label="${1:chave-bibtex}" />',
    description:
      "Citação simples. A chave deve existir na coleção References do Payload.",
    category: "citations",
  },
  {
    label: "Multi-Citar",
    icon: BookMarked,
    template: '<Cite labels={["${1:chave1}", "${2:chave2}"]} />',
    description:
      "Agrupa várias referências em uma única citação: [1,2] ou (Autor1, Ano; Autor2, Ano)",
    category: "citations",
  },

  // ── Presentation (Slides) ──
  {
    label: "Capa",
    icon: Maximize,
    template:
      '<SlideCover\n  title="${1:Título Principal}"\n  subtitle="${2:Subtítulo de Apoio}"\n  author="${3:Nome do Autor}"\n  date="${4:Maio 2026}"\n  backgroundImage="${5:/api/media/file/background.png}"\n  backgroundMaskOpacity="${6:60%}"\n  backgroundMaskBlur="${7:2px}"\n  logoImage="${8:/api/media/file/logo.png}"\n/>\n\n',
    description: "Capa do slide (primeiro slide)",
    category: "presentation",
  },
  {
    label: "Quebra de Slide",
    icon: Presentation,
    template: "<SlideBreak />\n\n",
    description:
      "Força a quebra para um novo slide (H1, H2 e H3 também quebram automaticamente)",
    category: "presentation",
  },
  {
    label: "Segunda Coluna",
    icon: Columns2,
    template:
      '<SlideSecondColumnContent width="${1:50%}">\n\n${2:Conteúdo da segunda coluna}\n\n</SlideSecondColumnContent>\n\n',
    description: "Cria um layout de duas colunas neste slide",
    category: "presentation",
  },
  {
    label: "Apenas Texto",
    icon: AlignLeft,
    template:
      "<TextOnly>\n${1:Este conteúdo aparece apenas na leitura (não nos slides)}\n</TextOnly>\n",
    description: "Conteúdo oculto na visualização de slides",
    category: "presentation",
  },
  {
    label: "Apenas Slides",
    icon: Monitor,
    template:
      "<PresentOnly>\n${1:Este conteúdo aparece apenas nos slides (não na leitura)}\n</PresentOnly>\n",
    description: "Conteúdo oculto na visualização de texto corrido",
    category: "presentation",
  },
  {
    label: "Manter no Slide",
    icon: CornerDownRight,
    template: "<SkipBreak />\n",
    description:
      "Impede que o próximo H1/H2/H3 crie um novo slide (cabeçalho permanece no slide atual)",
    category: "presentation",
  },

  // ── Questions ──
  {
    label: "Exercício",
    icon: Dumbbell,
    template:
      '<Question type="exercise" title="${1:Título do exercício}" initialState="contracted">\n${2:Enunciado do exercício.}\n\n<Hint>\n${3:Uma dica para ajudar.}\n</Hint>\n\n<Answer>\n${4:Solução detalhada.}\n</Answer>\n</Question>\n',
    description: "Bloco de exercício com dica e resposta recolhíveis",
    category: "questions",
  },
  {
    label: "Exemplo",
    icon: BookOpen,
    template:
      '<Question type="example" title="${1:Título do exemplo}" initialState="expanded">\n${2:Descrição do exemplo.}\n</Question>\n',
    description: "Bloco de exemplo resolvido (resposta expandida por padrão)",
    category: "questions",
  },
  {
    label: "Problema",
    icon: Brain,
    template:
      '<Question type="problem" title="${1:Título do problema}" initialState="contracted">\n${2:Enunciado do problema.}\n\n<Hint>\n${3:Uma dica para ajudar.}\n</Hint>\n\n<Answer>\n${4:Solução detalhada.}\n</Answer>\n</Question>\n',
    description: "Bloco de problema com dica e solução recolhíveis",
    category: "questions",
  },
  {
    label: "Definição",
    icon: BookText,
    template:
      '<Question type="definition" title="${1:Termo ou conceito}" initialState="expanded">\n${2:Definição formal do conceito.}\n</Question>\n',
    description: "Bloco de definição (sem resposta, expandido por padrão)",
    category: "questions",
  },
  {
    label: "Resposta",
    icon: Check,
    template: "<Answer>\n${1:Resposta ou solução.}\n</Answer>\n",
    description: "Seção de resposta dentro de um bloco Question",
    category: "questions",
  },
  {
    label: "Dica",
    icon: Lightbulb,
    template: "<Hint>\n${1:Dica para o aluno.}\n</Hint>\n",
    description: "Seção de dica dentro de um bloco Question",
    category: "questions",
  },

  // ── Authoring (invisible in output) ──
  {
    label: "Comentário",
    icon: MessageSquareDashed,
    template: "<Comment>\n${1:Nota do autor — não aparece no conteúdo publicado.}\n</Comment>\n",
    description: "Bloco invisível para notas do autor (não renderizado no conteúdo final)",
    category: "authoring",
  },
  {
    label: "TODO",
    icon: ListTodo,
    template: "<Todo>\n${1:Descreva o que precisa ser feito aqui.}\n</Todo>\n",
    description: "Pendência do autor — visível no painel /admin/todos, nunca no conteúdo final",
    category: "authoring",
  },
];

const CATEGORY_LABELS: Record<Snippet["category"], string> = {
  structure: "Estrutura",
  content: "Conteúdo",
  media: "Mídia",
  figures: "Figuras",
  citations: "Citações",
  questions: "Questões",
  presentation: "Apresentação",
  authoring: "Notas",
};

const CATEGORY_ORDER: Snippet["category"][] = [
  "structure",
  "content",
  "media",
  "figures",
  "citations",
  "questions",
  "presentation",
  "authoring",
];

/* ──────────────────────────────────────
   Component
   ──────────────────────────────────── */

interface MonacoMDXFieldProps {
  path: string;
  field: {
    name: string;
    label?: string | Record<string, string>;
    admin?: {
      description?: string;
    };
  };
}

// Placeholder for Button component if not imported from a UI library
// In a real application, you would import this from your component library.
const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }
> = ({ children, className, ...props }) => (
  <button className={className} {...props}>
    {children}
  </button>
);

export const MonacoMDXField: React.FC<MonacoMDXFieldProps> = ({
  path,
  field,
}) => {
  const { value, setValue } = useField<string>({ path });
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleEditorMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editorInstance;
      monacoRef.current = monaco;

      // Register MDX-flavored snippets as Monaco suggestions
      monaco.languages.registerCompletionItemProvider("markdown", {
        provideCompletionItems: (model: editor.ITextModel, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endLineNumber: position.lineNumber,
            endColumn: word.endColumn,
          };

          const suggestions = SNIPPETS.map((s) => ({
            label: s.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            documentation: s.description,
            insertText: s.template,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          }));

          return { suggestions };
        },
        triggerCharacters: ["<", "/", "#", "$"],
      });
    },
    [],
  );

  // Intercept and disable Cmd+S / Ctrl+S
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        console.log("Cmd+S intercepted and disabled.");
      }
    };
    window.addEventListener("keydown", handleKeyDown, true); // useCapture=true to catch it first
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const insertSnippet = useCallback(
    (template: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();
      const selection = editor.getSelection();
      if (!selection) return;

      // Find selected text (to wrap in a snippet if applicable)
      const selectedText = editor.getModel()?.getValueInRange(selection) || "";

      // Replace ${1:...} placeholders — use selected text as first placeholder value
      let finalText = template;
      if (selectedText) {
        finalText = finalText.replace(/\$\{1:[^}]*\}/, selectedText);
      } else {
        // Remove placeholder markers but keep default text
        finalText = finalText.replace(/\$\{(\d+)\|([^}]*)\}/g, "$2");
        finalText = finalText.replace(/\$\{(\d+):([^}]*)\}/g, "$2");
      }

      // Execute an edit operation so it goes onto the undo stack
      editor.executeEdits("snippet", [
        {
          range: selection,
          text: finalText,
          forceMoveMarkers: true,
        },
      ]);

      // Trigger autosave by updating the Payload field value
      const newValue = editor.getModel()?.getValue() || "";
      setValue(newValue);
    },
    [setValue],
  );

  // Specific handlers for presentation snippets using Lucide icons
  const insertSlideCover = useCallback(() => {
    insertSnippet(
      '<SlideCover\n  title="${1:Título Principal}"\n  subtitle="${2:Subtítulo de Apoio}"\n  author="${3:Nome do Autor}"\n  date="${4:Maio 2026}"\n  backgroundImage="${5:/api/media/file/background.png}"\n  backgroundMaskOpacity="${6:60%}"\n  backgroundMaskBlur="${7:2px}"\n  logoImage="${8:/api/media/file/logo.png}"\n/>\n\n',
    );
  }, [insertSnippet]);

  const insertSlideBreak = useCallback(() => {
    insertSnippet("<SlideBreak />\n\n");
  }, [insertSnippet]);

  const insertSlideSecondColumn = useCallback(() => {
    insertSnippet(
      '<SlideSecondColumnContent width="${1:50%}">\n\n${2:Conteúdo da segunda coluna}\n\n</SlideSecondColumnContent>\n\n',
    );
  }, [insertSnippet]);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      setValue(newValue ?? "");
    },
    [setValue],
  );

  // Group snippets by category
  const groupedSnippets = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: SNIPPETS.filter((s) => s.category === cat),
  }));

  const fieldLabel =
    typeof field.label === "string"
      ? field.label
      : typeof field.label === "object"
        ? Object.values(field.label)[0]
        : field.name;

  return (
    <div className="field-type textarea" style={{ marginBottom: "24px" }}>
      {/* Label */}
      <label
        className="field-label"
        style={{
          display: "block",
          marginBottom: "8px",
          fontSize: "13px",
          fontWeight: 600,
          textTransform: "capitalize",
        }}
      >
        {fieldLabel}
      </label>

      {/* Snippet Toolbar */}
      {/* Snippet Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "2px",
          padding: "6px 8px",
          background: "#1e1e1e",
          borderRadius: "8px 8px 0 0",
          borderBottom: "1px solid #333",
          alignItems: "center",
        }}
      >
        {groupedSnippets.map((group, gi) => (
          <React.Fragment key={group.category}>
            {gi > 0 && (
              <div
                style={{
                  width: "1px",
                  height: "24px",
                  background: "#444",
                  margin: "0 6px",
                }}
              />
            )}
            <span
              style={{
                fontSize: "10px",
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginRight: "4px",
                userSelect: "none",
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
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "32px",
                  height: "28px",
                  padding: "0 8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  background: "#2d2d2d",
                  color: "#ccc",
                  border: "1px solid #444",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#3a3d41";
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.borderColor = "#5a8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#2d2d2d";
                  e.currentTarget.style.color = "#ccc";
                  e.currentTarget.style.borderColor = "#444";
                }}
              >
                {typeof snippet.icon === "string" ? (
                  snippet.icon
                ) : (
                  <snippet.icon className="w-4 h-4" />
                )}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Monaco Editor */}
      <div
        style={{
          border: "1px solid #333",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          overflow: "hidden",
        }}
      >
        <Editor
          height="60vh"
          defaultLanguage="markdown"
          theme="vs-dark"
          value={value || ""}
          onChange={handleChange}
          onMount={handleEditorMount}
          options={{
            fontSize: 14,
            fontFamily: "'IBM Plex Mono', 'Fira Code', Menlo, monospace",
            lineNumbers: "on",
            wordWrap: "on",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: "line",
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            padding: { top: 12, bottom: 12 },
            suggest: {
              showSnippets: true,
              snippetsPreventQuickSuggestions: false,
            },
            tabSize: 2,
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: "always",
            autoClosingQuotes: "always",
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
            marginTop: "6px",
            fontSize: "12px",
            color: "#888",
          }}
        >
          {field.admin.description}
        </div>
      )}
    </div>
  );
};

export default MonacoMDXField;
