import type { CollectionConfig } from "payload";

export const References: CollectionConfig = {
  slug: "references",
  admin: {
    useAsTitle: "key",
    defaultColumns: ["key", "title", "authors", "year"],
    description:
      "Academic references. Paste the BibTeX entry; title/authors/year are auto-displayed for convenience.",
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    update: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "professor",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description:
          'BibTeX cite key (e.g. corke2011robotics). Must match exactly what you use in <Cite label="..." />.',
      },
    },
    {
      name: "bibtex",
      type: "textarea",
      required: true,
      admin: {
        description:
          "Full BibTeX entry. Example: @book{corke2011robotics, author = {Corke, Peter}, title = {Robotics, Vision and Control}, year = {2011}, publisher = {Springer} }",
        rows: 10,
      },
    },
    {
      name: "doi",
      type: "text",
      admin: {
        description:
          "DOI (without the https://doi.org/ prefix). E.g. 10.1007/978-3-642-20144-8",
      },
    },
    {
      name: "externalUrl",
      type: "text",
      admin: {
        description: "Optional direct URL (publisher page, arXiv, etc.)",
      },
    },
    {
      name: "coverArt",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Optional cover image (book cover, conference logo, etc.)",
      },
    },
  ],
};
