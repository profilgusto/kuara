import type { CollectionConfig } from "payload";
import {
  syncCadernoMediaRefs,
  cleanCadernoMediaRefs,
} from "../hooks/syncMediaUsedIn.ts";

export const Cadernos: CollectionConfig = {
  slug: "cadernos",
  defaultSort: "-publishedAt",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "stage", "project", "publishedAt", "_status"],
    description:
      "Cadernos de pesquisa, notas técnicas e estudos independentes.",
    components: {
      edit: {
        SaveDraftButton: "@/admin/components/SaveDraftButton",
        PublishButton: "@/admin/components/CustomPublishButton",
      },
    },
  },
  access: {
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
    afterChange: [syncCadernoMediaRefs],
    afterDelete: [cleanCadernoMediaRefs],
  },
  versions: {
    drafts: {
      autosave: {
        showSaveDraftButton: true,
        interval: 300000, // 5 minutes in milliseconds
      },
    },
    maxPerDoc: 50,
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
      unique: true,
      admin: {
        description: "URL-friendly identifier used in /cadernos/[slug]",
      },
    },
    {
      name: "abstract",
      type: "textarea",
      admin: {
        description: "Plain text summary shown on listing cards.",
      },
    },
    {
      name: "content",
      type: "textarea",
      admin: {
        description:
          "Conteúdo MDX do caderno. Use a toolbar ou Ctrl+Espaço para inserir snippets.",
        components: {
          Field: "@/admin/components/MonacoMDXField",
        },
      },
    },
    {
      name: "stage",
      type: "select",
      required: true,
      defaultValue: "rascunho",
      options: [
        { label: "Rascunho", value: "rascunho" },
        { label: "Em andamento", value: "em-andamento" },
        { label: "Finalizado", value: "finalizado" },
        { label: "Incrementando", value: "incrementando" },
      ],
    },
    {
      name: "tags",
      type: "array",
      admin: {
        description: "Tags for filtering and graph clustering.",
      },
      fields: [
        {
          name: "tag",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "citationStyle",
      type: "select",
      defaultValue: "authoryear",
      admin: {
        description:
          "Citation style used when rendering <Cite /> components in this caderno.",
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
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Cover image shown on listing cards.",
      },
    },
    {
      name: "project",
      type: "text",
      admin: {
        description:
          'Free-text project label (e.g. "SLAM Robot", "Artigo IEEE 2026").',
      },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        description: "Manual publication date shown on cards and article header.",
        date: {
          pickerAppearance: "dayOnly",
          displayFormat: "d MMM yyyy",
        },
      },
    },
    {
      name: "relatedDisciplinas",
      type: "relationship",
      relationTo: "courses",
      hasMany: true,
      admin: {
        description: "Courses related to this caderno.",
      },
    },
    {
      name: "relatedModules",
      type: "relationship",
      relationTo: "modules",
      hasMany: true,
      admin: {
        description: "Course modules related to this caderno.",
      },
    },
    {
      name: "relatedCadernos",
      type: "relationship",
      relationTo: "cadernos",
      hasMany: true,
      admin: {
        description:
          'Directional: "I reference these cadernos." Incoming references are computed at query time.',
      },
    },
  ],
};
