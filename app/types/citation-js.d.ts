// Type stubs for @citation-js packages (no official @types available)
declare module "@citation-js/core" {
  export class Cite {
    constructor(input: string | object);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[];
    format(
      format: string,
      opts?: {
        format?: string;
        template?: string;
        lang?: string;
        [key: string]: unknown;
      },
    ): string;
  }
}

declare module "@citation-js/plugin-bibtex" {
  const plugin: unknown;
  export default plugin;
}

declare module "@citation-js/plugin-csl" {
  const plugin: unknown;
  export default plugin;
}
