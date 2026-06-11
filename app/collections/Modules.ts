import type { CollectionConfig } from "payload";
import {
  syncModuleMediaRefs,
  cleanModuleMediaRefs,
} from "../hooks/syncMediaUsedIn.ts";
import { syncModuleCrossRefs } from "../hooks/syncModuleCrossRefs.ts";
import { syncQuestionOffsets } from "../hooks/syncQuestionOffsets.ts";

export const Modules: CollectionConfig = {
  slug: "modules",
  folders: true,
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "type", "course", "order", "_status"],
    livePreview: {
      url: ({ data }) => {
        return `${process.env.NEXT_PUBLIC_SERVER_URL}/preview/modules/${data.id}`;
      },
    },
    components: {
      edit: {
        SaveDraftButton: "@/admin/components/SaveDraftButton",
        PublishButton: "@/admin/components/CustomPublishButton",
      },
    },
  },
  access: {
    // Public read requires item to be published (unless admin)
    read: ({ req: { user } }) => {
      if (user?.role === "admin" || user?.role === "professor") return true;
      return {
        _status: {
          equals: "published",
        },
      };
    },
    create: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    update: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    beforeChange: [syncModuleCrossRefs],
    afterChange: [syncModuleMediaRefs, syncQuestionOffsets],
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
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      admin: {
        description: "URL-friendly identifier (e.g., mt01-introducao)",
      },
    },
    {
      name: "authors",
      type: "text",
      admin: {
        components: {
          Field: "@/admin/components/AuthorsField",
        },
      },
    },
    {
      name: "content",
      type: "textarea",
      admin: {
        description:
          "Conteúdo MDX do módulo. Use a toolbar ou Ctrl+Espaço para inserir snippets.",
        components: {
          Field: "@/admin/components/MonacoMDXField",
        },
      },
    },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "Módulo Teórico", value: "modulo-teorico" },
        { label: "Módulo Prático", value: "modulo-pratico" },
        { label: "Atividade Avaliativa", value: "atividade-avaliativa" },
        { label: "Recurso", value: "recurso" },
      ],
    },
    {
      name: "course",
      type: "relationship",
      relationTo: "courses",
      required: true,
      admin: {
        description: "Parent course this module belongs to",
      },
    },
    {
      name: "order",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: {
        description: "Sort order within the course",
      },
    },
    {
      name: "visible",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description: "Controla se este módulo é listado na grade da disciplina.",
      },
    },
    {
      name: "linkable",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description: "Habilita o acesso a este módulo através de sua URL direta, mesmo se não estiver visível.",
      },
    },
    {
      name: "copyUrl",
      type: "ui",
      admin: {
        components: {
          Field: "@/admin/components/CopyUrlField",
        },
      },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        description: "Data de publicação do módulo.",
        date: {
          pickerAppearance: "dayOnly",
          displayFormat: "d MMM yyyy",
        },
      },
    },
    {
      name: "relatedModules",
      type: "relationship",
      relationTo: "modules",
      hasMany: true,
      admin: {
        hidden: true,
        description: "Auto-managed by <CiteModule> usage in content. Do not edit manually.",
      },
    },
    {
      name: "relatedTesselas",
      type: "relationship",
      relationTo: "tesselas",
      hasMany: true,
      admin: {
        hidden: true,
        description: "Auto-managed by <CiteTessela> usage in content. Do not edit manually.",
      },
    },
    {
      name: "citationStyle",
      type: "select",
      defaultValue: "authoryear",
      admin: {
        description:
          "Citation style used when rendering <Cite /> components in this module. Affects both inline citations and the auto-generated References section.",
      },
      options: [
        { label: "Autor-Ano — (Corke et al., 2011)", value: "authoryear" },
        { label: "APA 7ª ed. — (Corke et al., 2011)", value: "apa" },
        { label: "Chicago Autor-Data — (Corke et al. 2011)", value: "chicago" },
        { label: "Numérico — [1]", value: "numeric" },
        { label: "IEEE — [1]", value: "ieee" },
        { label: "Vancouver — [1]", value: "vancouver" },
      ],
    },
    {
      name: "questionOffsets",
      type: "json",
      admin: {
        hidden: true,
        description:
          "Auto-managed. Starting question numbers (per type) for this module within its course sequence. Updated on every publish.",
      },
    },
  ],
};
