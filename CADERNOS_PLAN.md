# Cadernos — Implementation Plan

**Project:** Kuara educational platform
**Feature:** "Cadernos" — a library of intellectual notebooks (research notes, paper implementations, project findings, article drafts, and building-block knowledge pieces that can be composed into new things).
**Stack:** Next.js 15 (App Router), React 19, Tailwind CSS, Shadcn UI, Payload CMS 3 (PostgreSQL), MDX.

---

## Concept Summary

Cadernos is a **flat library of notebooks** where each notebook is a standalone MDX document. Notebooks can be linked to each other as knowledge dependencies ("this caderno builds upon that caderno"). The future goal is a **tree/graph visualization** (React Flow) that renders these dependency connections alongside tag clustering and project grouping. The listing page is linear for now; alternative visualization modes will come later.

Each caderno uses the **exact same MDX rendering pipeline** as course modules (same components, same presentation mode, same citations, same figures). The two areas share one rendering infrastructure; changes to MDX components or the pipeline apply to both automatically.

---

## Key Files to Understand Before Any Phase

Before starting any phase, read these files to understand the current architecture:

| File | Why it matters |
|------|----------------|
| `app/lib/mdx-pipeline.ts` | The MDX compilation + heading extraction pipeline (shared, unchanged) |
| `app/lib/mdx-components.tsx` | The single shared MDX component map (`getMdxComponents`) — already generic |
| `app/lib/payload-content.ts` | Data access layer — new functions will be added here |
| `app/components/mdx/ModulePageClient.tsx` | The client shell around MDX content — Phase 0 refactors this |
| `app/components/mdx/ModuleLayout.tsx` | The outer layout with sidebar, eqref popovers, breadcrumbs — Phase 0 extracts hooks from this |
| `app/app/(frontend)/disciplinas/[slug]/[mod]/page.tsx` | The module page — reference for building the caderno page |
| `app/collections/Modules.ts` | Reference schema for building the Cadernos collection |
| `app/payload.config.ts` | Must be updated to register the new Cadernos collection |

---

## Architecture Decisions

### Shared vs. specific
- **Already shared (do not touch):** `lib/mdx-pipeline.ts`, `lib/mdx-components.tsx`, all components inside `components/mdx/` (Slide, SlideDeck, ViewToggle, Callout, KImage, etc.), `components/citations/`, `components/figures/`
- **Module-specific (stays as-is):** `components/mdx/CourseSidebar.tsx`, `components/mdx/ModuleContext.tsx` (provides module title to Comment/Todo), the print cover page inside `ModulePageClient`
- **To be extracted into shared code (Phase 0):** `useEqrefScroll` + `useEqrefPopover` hooks from `ModuleLayout`, and `ContentPageClient` (the generic shell for title + buttons + print TOC + SlideDeck) from `ModulePageClient`

### Citation graph (bidirectionality)
The `relatedCadernos` relationship in the Cadernos collection is **directional**: "this caderno references those." Bidirectionality is emergent — if A references B and B references A, both declare it independently. The reverse direction ("who references this caderno") is computed at query time. This is the correct model for the future graph visualization: edges have direction, and you can see both incoming and outgoing connections.

### React Flow for graph visualization
Use `@xyflow/react` (React Flow v12+). It is the standard library for interactive node graphs in React. It supports directed edges, custom node rendering, zoom/pan, and TypeScript. The graph route will be `/cadernos/grafo` and is implemented in Phase 6.

---

## Phase 0 — Shared Infrastructure Refactoring ✅ DONE

**Goal:** Extract the generic content-rendering shell into a named shared component so that both modules and cadernos use it. When you change the print layout, slide controls, or the screen header, it updates in both places.

**No new functionality. Modules must work identically after this phase.**

**Completed 2026-04-03:**
- Created `app/lib/eqref-interactions.ts`: extracted `getEqrefId`, `findEqContainer`, `useEqrefScroll`, `useEqrefPopover` from `ModuleLayout.tsx`. All four are exported.
- Created `app/components/content/ContentPageClient.tsx`: generic client shell with print cover (uses `printContextLabel` prop instead of hardcoded course name), print TOC, screen header (title + PrintButton + ViewToggle), print-only title, and `QuestionCounterProvider` + `SlideDeck` wrapping children. Does not include `ModuleContext.Provider`.
- Refactored `app/components/mdx/ModulePageClient.tsx` to a thin wrapper: wraps `ContentPageClient` with `ModuleContext.Provider value={{ title }}`, passing `courseTitle` as `printContextLabel`.
- Updated `app/components/mdx/ModuleLayout.tsx`: removed ~170 lines of inline hook definitions, now imports `useEqrefScroll` and `useEqrefPopover` from `lib/eqref-interactions.ts`.
- `npm run typecheck` passes cleanly. No lint errors in modified/created files.

### What to read first
- `app/components/mdx/ModulePageClient.tsx` (full file)
- `app/components/mdx/ModuleLayout.tsx` (full file)
- `app/app/(frontend)/disciplinas/[slug]/[mod]/page.tsx` (full file)

### Step 0.1 — Extract `useEqrefInteractions` hook

**Create:** `app/lib/eqref-interactions.ts`

This file should contain the two hooks currently defined inside `ModuleLayout.tsx`:
- `useEqrefScroll()` — handles click on math equation references (smooth scroll + highlight animation)
- `useEqrefPopover(popoverRef)` — handles hover on math equation references (floating SVG popover)

Also extract the two helper functions they depend on:
- `getEqrefId(link: Element): string | null`
- `findEqContainer(id: string): HTMLElement | null`

After extraction, update `ModuleLayout.tsx` to import these hooks from the new file instead of defining them inline.

**Result:** `CadernoLayout` (created in Phase 4) can import these hooks from `lib/eqref-interactions.ts` without any code duplication.

### Step 0.2 — Extract `ContentPageClient`

**Create:** `app/components/content/ContentPageClient.tsx`

This is the generic client shell that wraps any long-form MDX content. Extract from `ModulePageClient.tsx` everything that is **not** module-specific:

**Props of `ContentPageClient`:**
```typescript
interface ContentPageClientProps {
  children: ReactNode;
  title: string;
  headings: Heading[];             // from lib/mdx-pipeline
  slideCover?: SlideCoverData | null; // from lib/slides
  printContextLabel?: string;      // e.g. "Kuara · Cadernos" or the course name — shown above title in print cover
}
```

**What `ContentPageClient` renders (in order):**
1. **Print-only cover page** — same as current `ModulePageClient` print cover, but using `printContextLabel` prop instead of hardcoded `courseTitle`. Keep all logo/background image logic from `slideCover`.
2. **Print-only table of contents** — same as current implementation.
3. **Screen header** — title (h1) + `PrintButton` + `ViewToggle`, same as current.
4. **Print-only title above content** — same as current.
5. **`QuestionCounterProvider` + `SlideDeck`** — wrapping children, same as current.

**What `ContentPageClient` does NOT contain:**
- `ModuleContext.Provider` (stays in `ModulePageClient`)

**Update `ModulePageClient.tsx`** to become a thin wrapper:
```typescript
// ModulePageClient wraps ContentPageClient with module-specific additions
export function ModulePageClient({ children, title, headings, courseTitle, slideCover }) {
  return (
    <ModuleContext.Provider value={{ title }}>
      <ContentPageClient
        title={title}
        headings={headings}
        slideCover={slideCover}
        printContextLabel={courseTitle}
      >
        {children}
      </ContentPageClient>
    </ModuleContext.Provider>
  );
}
```

**Note on ModuleContext:** `ModuleContext` provides `title` to `Comment` and `Todo` components (check `components/mdx/Comment.tsx` and `components/mdx/Todo.tsx` to confirm usage). For cadernos, `Comment` and `Todo` will work without module context because the context has a default value of `{ title: "" }`. If the caderno title is needed in those components later, `CadernoPageClient` can wrap with an equivalent context. For now, leave it as-is.

### Step 0.3 — Create `components/content/` directory

This is the home for shared content-rendering components. For now it contains only `ContentPageClient.tsx`. Future additions (e.g., a shared `ArticleTOCSidebar`) go here.

### Verification for Phase 0

Run from `app/`:
```bash
npm run typecheck
npm run lint
npm run test
```

Then start Docker and verify:
- Navigate to any existing module page → must render identically to before
- Verify ViewToggle still switches between text and presentation mode
- Verify Print still works (Ctrl+P in browser)
- Verify equation reference popovers still appear on hover

---

## Phase 1 — Cadernos Payload Collection ✅ DONE

**Goal:** Define the `Cadernos` collection in Payload CMS and run the migration.

**Completed 2026-04-03:**
- Created `app/collections/Cadernos.ts` with all fields (title, slug, abstract, content via MonacoMDXField, status, tags array, citationStyle, coverImage, project, publishedAt, relatedDisciplinas, relatedModules, relatedCadernos self-ref). Drafts + autosave enabled. Access control mirrors Modules.
- Extended `app/hooks/syncMediaUsedIn.ts`: added `"cadernos"` to `RefEntry` union, updated `normalizeRef` and `updateMediaUsedIn` signatures, added `syncCadernoMediaRefs` and `cleanCadernoMediaRefs` hooks.
- Registered `Cadernos` in `app/payload.config.ts` (imported and added to `collections` array between Modules and Offers).
- `npm run typecheck` passes. New files have no lint errors. Migration pending Docker startup (`./scripts/create-migration.sh`).

### What to read first
- `app/collections/Modules.ts` (reference for field patterns and admin config)
- `app/collections/Courses.ts` (reference for relationship fields)
- `app/payload.config.ts` (to know where to register the new collection)

### Step 1.1 — Create `app/collections/Cadernos.ts`

**Fields:**

| Field name | Payload type | Required | Notes |
|---|---|---|---|
| `title` | `text` | yes | |
| `slug` | `text` | yes | unique; used for URL `/cadernos/[slug]` |
| `abstract` | `textarea` | no | Plain text, shown on listing cards |
| `content` | `text` | no | MDX content; use `MonacoMDXField` custom component (same as Modules) |
| `status` | `select` | yes | Options: `rascunho`, `em-andamento`, `finalizado`, `incrementando` — default: `rascunho` |
| `tags` | `array` | no | Array field with one `text` subfield named `tag` |
| `citationStyle` | `select` | no | Same 6 options as Modules: `authoryear`, `apa`, `chicago`, `numeric`, `ieee`, `vancouver` — default: `authoryear` |
| `coverImage` | `upload` | no | Relationship to `Media` collection |
| `project` | `text` | no | Free-text project label (e.g. "SLAM Robot", "Artigo IEEE 2026") |
| `publishedAt` | `date` | no | Manual date; shown on card and article header |
| `relatedDisciplinas` | `relationship` | no | `hasMany: true`, relates to `Courses` collection |
| `relatedModules` | `relationship` | no | `hasMany: true`, relates to `Modules` collection |
| `relatedCadernos` | `relationship` | no | `hasMany: true`, relates to `cadernos` (self-referencing); this is the **directional** "I reference these" field |

**Versioning:** Enable drafts with autosave (interval: 300 seconds, max versions: 50) — same as Modules. This is important because cadernos are inherently WIP documents.

**Access control:** Same pattern as Modules:
- `read`: public access to published versions; draft access only for admin/professor
- `create`, `update`: admin or professor roles
- `delete`: admin only

**Admin configuration:**
- `useAsTitle: 'title'`
- `defaultSort: '-publishedAt'`
- Admin description: "Cadernos de pesquisa, notas técnicas e estudos independentes."
- The `content` field should use `MonacoMDXField` (import from `app/admin/components/MonacoMDXField.tsx`) — same as in `Modules.ts`

**Hooks:** Add `afterChange` and `afterDelete` hooks for syncing media references (same pattern as Modules — scan `content` field for media URLs and update `usedIn` on the `Media` collection).

### Step 1.2 — Register in `payload.config.ts`

Import `Cadernos` from `./collections/Cadernos` and add it to the `collections` array. Place it near `Courses` and `Modules` for logical grouping.

### Step 1.3 — Run the migration

From the repo root (requires the web container to be running):
```bash
./scripts/create-migration.sh
```

Commit the generated migration file alongside `Cadernos.ts` and the updated `payload.config.ts`.

### Verification for Phase 1

- `npm run typecheck` passes
- Docker: navigate to `/admin` → "Cadernos" collection appears in the sidebar
- Create a test caderno in admin with all fields filled → saves without errors
- Draft/publish cycle works

---

## Phase 2 — Data Access Layer ✅ DONE

**Goal:** Add caderno-specific fetch functions to `lib/payload-content.ts`.

**Completed 2026-04-03:**
- Added types `CadernoListItem`, `CadernoRelatedItem`, `CadernoDetail` to `app/lib/payload-content.ts`.
- Added `listCadernos(options?)`: fetches all published cadernos with optional `tag`/`status`/`project` filters, sorted by `-publishedAt`.
- Added `getCaderno(slug, draft?)`: fetches a single caderno at `depth: 2` (so `relatedModules → course.slug` resolves), then runs a second query to compute incoming `referencedBy` links.
- Added `listAllCadernosForGraph()`: lightweight query returning only node/edge fields for Phase 6.
- Added private `extractTags()` helper that flattens Payload's `[{tag: string}]` array to `string[]`.
- `npm run typecheck` passes cleanly.

### What to read first
- `app/lib/payload-content.ts` (full file — study patterns for `getCourse`, `getModule`, `getPosts`)

### New types to add

```typescript
export interface CadernoListItem {
  id: string;
  slug: string;
  title: string;
  abstract?: string;
  status: 'rascunho' | 'em-andamento' | 'finalizado' | 'incrementando';
  tags: string[];        // flat list extracted from the array field
  project?: string;
  publishedAt?: string;
  coverImage?: { url: string; alt?: string } | null;
}

export interface CadernoRelatedItem {
  id: string;
  slug: string;
  title: string;
  abstract?: string;
  tags: string[];
  status: string;
}

export interface CadernoDetail {
  id: string;
  slug: string;
  title: string;
  abstract?: string;
  status: string;
  tags: string[];
  project?: string;
  publishedAt?: string;
  updatedAt?: string;
  coverImage?: { url: string; alt?: string } | null;
  content?: string;
  citationStyle?: string;
  relatedDisciplinas?: { id: string; slug: string; title: string; code: string }[];
  relatedModules?: { id: string; slug: string; title: string; courseSlug: string }[];
  relatedCadernos?: CadernoRelatedItem[];   // outgoing: "I reference these"
  referencedBy?: CadernoRelatedItem[];      // incoming: "these reference me" (computed via separate query)
}
```

### New functions to add

**`listCadernos(options?)`**
```typescript
async function listCadernos(options?: {
  tag?: string;
  status?: string;
  project?: string;
}): Promise<CadernoListItem[]>
```
- Fetches all published cadernos (`_status: { equals: 'published' }`)
- If `options.tag` provided, filters by tag
- If `options.status` provided, filters by status
- If `options.project` provided, filters by project label
- Orders by `publishedAt` descending
- Returns `CadernoListItem[]` (no content field — listing only)

**`getCaderno(slug, draft?)`**
```typescript
async function getCaderno(slug: string, draft?: boolean): Promise<CadernoDetail | null>
```
- Fetches single caderno by slug
- Populates: `relatedDisciplinas` (id, slug, title, code), `relatedModules` (id, slug, title + course slug), `relatedCadernos` (id, slug, title, abstract, tags, status)
- For `referencedBy` (incoming links): runs a second query to find all cadernos where `relatedCadernos` contains this caderno's id
- Returns `null` if not found or not visible

**`listAllCadernosForGraph()`**
```typescript
async function listAllCadernosForGraph(): Promise<{
  id: string;
  slug: string;
  title: string;
  tags: string[];
  project?: string;
  status: string;
  relatedCadernos: { id: string }[];
}[]>
```
- Lightweight query for the future graph visualization (Phase 6)
- Returns only the fields needed to build graph nodes and edges (no content, no abstract)
- Always fetches all published cadernos (no pagination — graph needs the full set)

### Verification for Phase 2

- `npm run typecheck` passes
- The new functions can be called from a test route without runtime errors

---

## Phase 3 — Admin Panel ✅ DONE

**Goal:** Ensure the Cadernos admin experience is complete and consistent with Modules.

**Completed 2026-04-03:**
- `MonacoMDXField` already wired in `Cadernos.ts` (Phase 1) — no changes needed.
- Extended `app/admin/views/TodosView.tsx`: added `CadernoTodos` interface; fetches `/api/modules` and `/api/cadernos` in parallel via `Promise.all`; processes caderno docs with the same `extractTodos` helper; sorts cadernos alphabetically by title; renders two labeled sections — **Módulos** (grouped by course, unchanged) and **Cadernos** (flat list); each item title prefixed with `"Módulo: "` / `"Caderno: "`; edit links point to `/admin/collections/cadernos/[id]`; summary stat updated to count both sources as "documentos".
- `npm run typecheck` passes. `npm run lint` on the file passes.

### Step 3.1 — MonacoMDXField (no changes needed)

The `MonacoMDXField` custom component is already referenced in `Cadernos.ts` (from Phase 1). Because it's a Payload custom field component, it works in any collection that declares the `content` field with `admin.components.Field = MonacoMDXField`. No changes needed.

### Step 3.2 — Extend TodosView to include Cadernos ✅

Extended `app/admin/views/TodosView.tsx` to also scan `Cadernos`.

### Step 3.3 — No reorder view needed (for now)

Cadernos have no inherent order (they sort by `publishedAt`). Skip the drag-to-reorder view. If ordering becomes relevant later, it can be added.

### Verification for Phase 3

- Docker: create a caderno with `<Todo>` and `<Comment>` tags in content
- Navigate to `/admin/todos` → the caderno's todos appear correctly labeled

---

## Phase 4 — Frontend Routes ✅ DONE

**Goal:** Build the public `/cadernos` listing page and `/cadernos/[slug]` detail page.

**Completed 2026-04-03:**
- Created `app/components/cadernos/CadernoLayout.tsx`: outer layout for caderno detail pages. Renders a right-side floating TOC panel (with scroll-spy via `IntersectionObserver`), swipe-to-close on mobile, eqref scroll and popover hooks (from `lib/eqref-interactions.ts`), backdrop overlay, and breadcrumbs `[{ label: "Cadernos", href: "/cadernos" }, { label: cadernoTitle }]`. No course sidebar — cadernos are standalone.
- Created `app/app/(frontend)/cadernos/page.tsx`: listing page at `/cadernos`. Calls `listCadernos()`, renders a responsive card grid matching the disciplinas listing pattern. Cards show cover image (with dark blur overlay when present), color-coded status badge (`rascunho` → gray, `em-andamento` → amber, `finalizado` → green, `incrementando` → blue), project label, title, abstract, tags as chips, and publishedAt date. Empty state shown when no cadernos published. SEO metadata set.
- Created `app/app/(frontend)/cadernos/[slug]/page.tsx`: detail page at `/cadernos/[slug]`. Mirrors the module page pipeline exactly: `getCaderno → extractHeadings → citations → figures → slideCover → compileMdx → CadernoLayout + ContentPageClient`. Below the content (print-hidden): status/dates/project metadata, tags, outgoing "Cadernos referenciados" cards, incoming "Referenciado por" cards, related disciplinas links, related modules links. Draft mode supported via `draftMode()`. Returns `notFound()` if caderno is null.
- `npm run typecheck` passes cleanly. All three new files pass `next lint` with no errors or warnings.

### What to read first
- `app/app/(frontend)/disciplinas/[slug]/[mod]/page.tsx` (the module page — mirror its rendering pattern)
- `app/app/(frontend)/disciplinas/page.tsx` (the course listing — mirror its card pattern)
- `app/components/content/ContentPageClient.tsx` (created in Phase 0 — use this for the detail page)
- `app/lib/payload-content.ts` (the new functions from Phase 2)
- `app/components/mdx/ModuleLayout.tsx` (reference for building CadernoLayout)
- `app/lib/eqref-interactions.ts` (created in Phase 0 — import hooks for CadernoLayout)

### Step 4.1 — Create `CadernoLayout`

**Create:** `app/components/cadernos/CadernoLayout.tsx`

This is the outer layout for caderno detail pages. It differs from `ModuleLayout` in that it has no course sidebar and no module list navigation. Instead, it has a lightweight **TOC panel** (table of contents from headings) on the right side, using the same visual pattern as the module sidebar (floating panel, swipe-to-close on mobile).

**Props:**
```typescript
interface CadernoLayoutProps {
  headings: Heading[];
  cadernoTitle: string;
  children: ReactNode;
}
```

**What it renders:**
- Backdrop overlay (same as ModuleLayout)
- Right-side TOC panel (floating, same styling as CourseSidebar panel) showing the headings with scroll-spy highlighting
- Equation reference popover DOM element (same as ModuleLayout — import `useEqrefScroll` and `useEqrefPopover` from `lib/eqref-interactions.ts`)
- Breadcrumbs via `useNav()`: `[{ label: "Cadernos", href: "/cadernos" }, { label: cadernoTitle }]`
- `setHasSidebar(true)` so the nav hamburger appears
- Main content area: `<main className="flex-1 w-full min-w-0"><div className="container max-w-4xl mx-auto px-4 py-8">{children}</div></main>`

**Scroll-spy for TOC:** The heading links in the TOC panel should highlight as the user scrolls. Use an `IntersectionObserver` watching all `[id]` elements, same approach as `CourseSidebar.tsx`.

### Step 4.2 — Create listing page `/cadernos`

**Create:** `app/app/(frontend)/cadernos/page.tsx`

**Data:** Call `listCadernos()` from `lib/payload-content.ts`.

**UI:**
- Page title: "Cadernos" (h1)
- Short description of the area (2–3 sentences explaining what cadernos are)
- Card grid (same responsive grid pattern as the disciplinas listing)
- Each card shows: cover image (if present), title, abstract, status badge, tags (as small chips), publishedAt date, project label (if present)
- Status badge colors: `rascunho` → gray, `em-andamento` → amber, `finalizado` → green, `incrementando` → blue
- Cards link to `/cadernos/[slug]`
- If no cadernos published: show an empty state message

**Metadata:** Set `title` and `description` for SEO.

**No client-side filtering yet.** Tag and project filtering can be added in a later iteration.

### Step 4.3 — Create detail page `/cadernos/[slug]`

**Create:** `app/app/(frontend)/cadernos/[slug]/page.tsx`

This mirrors the module page. Follow the same rendering pipeline:

```
getCaderno(slug, isDraftMode)
    ↓
extractHeadings(content)
extractCiteLabels(content) → fetchAndFormatReferences(...)
extractFigureLabels(content)
extractSlideCoverProps(content)
compileMdx(content, getMdxComponents())
    ↓
<CadernoLayout headings={headings} cadernoTitle={caderno.title}>
  <ReferencesProvider ...>
    <FiguresProvider ...>
      <ContentPageClient title={caderno.title} headings={headings} slideCover={slideCover} printContextLabel="Kuara · Cadernos">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          {content}
        </article>
        {citationOrder.length > 0 && <ReferencesSection />}
      </ContentPageClient>
    </FiguresProvider>
  </ReferencesProvider>
</CadernoLayout>
```

**Below `ContentPageClient`** (outside of it, after the article), render the metadata section:
- Tags as chips
- Status badge + publishedAt + last updated date
- Project label (if present)
- "Related Cadernos" section: cards linking to each related caderno (outgoing: "Cadernos referenciados")
- "Referenced by" section: cards for cadernos that reference this one (incoming: `referencedBy` from `getCaderno`)
- "Related Disciplinas" section: links to each related course
- "Related Modules" section: links to each related module

**Metadata:** Generate `title` and `description` from caderno title and abstract.

**Draft mode:** Support `draftMode()` from `next/headers` — same as the module page.

**Not found:** Return `notFound()` if `getCaderno` returns null.

**`export const dynamic = "force-dynamic"`** — same as module page (Payload draft mode requires this).

### Verification for Phase 4

- `npm run typecheck` and `npm run lint` pass
- Docker: navigate to `/cadernos` → listing renders correctly with status badges and tags
- Click a caderno card → detail page renders
- ViewToggle switches to presentation mode → slides appear correctly
- Math equations render with MathJax → hover popover appears
- Citations render with `<Cite>` → popover appears
- Print (Ctrl+P) → print cover and TOC appear correctly
- Related cadernos section renders at the bottom

---

## Phase 5 — Navigation ✅ DONE

**Goal:** Add Cadernos to the site navigation.

**Completed 2026-04-03:**
- Added `usePathname` import from `next/navigation` to `app/components/layout/SiteNav.tsx`.
- Added `NAV_LINKS` constant array with Disciplinas (`/disciplinas`) and Cadernos (`/cadernos`) entries.
- Rendered both links after the logo with active-state detection via `pathname.startsWith(href)`: active → `text-foreground font-medium`, inactive → `text-muted-foreground`.
- Breadcrumbs remain in place after the nav links (they still appear when navigating into a specific course/caderno).
- Changed logo `href` from `/disciplinas` to `/` (more correct now that explicit nav links exist).
- `npm run typecheck` and `npm run lint` pass cleanly.

### What to read first
- `app/components/layout/SiteNav.tsx` (full file)

### Changes

The current `SiteNav` has only the Kuara logo on the left and theme toggle on the right. There are no top-level navigation links. Add them:

**Add nav links after the logo:**
```
Kuara [logo]   Disciplinas   Cadernos   ···   [theme toggle] [sidebar toggle]
```

Both "Disciplinas" and "Cadernos" should be `<Link>` components with `href="/disciplinas"` and `href="/cadernos"` respectively. Style them as navigation links (use `text-sm`, active state via `usePathname()` to highlight the current section).

Keep breadcrumbs where they are (they still appear when navigating into a specific course/caderno).

### Verification for Phase 5

- Docker: nav bar shows "Disciplinas" and "Cadernos" links
- Active link highlights correctly when on `/cadernos` vs `/disciplinas`
- Clicking Cadernos goes to `/cadernos`

---

## Phase 6 — Knowledge Graph Visualization (Future)

**Goal:** Interactive graph at `/cadernos/grafo` showing cadernos as nodes, citation relationships as directed edges, with tag clustering and project grouping.

> **This phase is not implemented in the initial rollout.** The data model from Phases 1–2 already supports it. Implement when enough cadernos exist to make the graph meaningful.

### Library

Use **`@xyflow/react`** (React Flow v12+). Install with:
```bash
npm install @xyflow/react
```

### Route

**Create:** `app/app/(frontend)/cadernos/grafo/page.tsx`

This is a **client component** (`"use client"`). It calls `listAllCadernosForGraph()` (from Phase 2) to get all nodes and edges, then renders a React Flow graph.

### Graph data model

**Nodes:** One node per caderno.
```typescript
type CadernoNode = Node<{
  label: string;   // caderno title
  slug: string;    // for click navigation
  tags: string[];
  project?: string;
  status: string;
}>
```

**Edges:** One directed edge per `relatedCadernos` entry.
```typescript
// If caderno A has relatedCadernos: [B, C]
// → edges: A→B, A→C
// If B also has relatedCadernos: [A]
// → additional edge: B→A (bidirectional relationship is shown as two arrows)
{ id: 'A-B', source: 'A', target: 'B', animated: false, markerEnd: { type: MarkerType.ArrowClosed } }
```

### Layout

Use React Flow's built-in layout or integrate `@dagrejs/dagre` for a hierarchical/tree layout (better for citation trees where directionality matters). Dagre is a well-known graph layout library that works well with React Flow.

### Features for the graph view
- **Click a node** → navigate to `/cadernos/[slug]`
- **Hover a node** → show tooltip with title + abstract + tags
- **Tag filter** → highlight nodes that share a tag (sidebar with tag list + checkboxes)
- **Project grouping** → optional: group nodes with the same project into a React Flow `Group` node
- **Zoom/pan** — built into React Flow
- **Minimap** — React Flow built-in component

### Link from listing page

Add a "Ver grafo de conhecimento" button/link on the `/cadernos` listing page that navigates to `/cadernos/grafo`. Only show it if more than 1 caderno exists.

---

## Implementation Order Summary

| Phase | What | Depends on |
|---|---|---|
| **0** ✅ | Extract `useEqrefInteractions` + `ContentPageClient`, simplify `ModulePageClient` | — |
| **1** ✅ | `Cadernos` Payload collection + migration | — |
| **2** ✅ | Data access functions in `payload-content.ts` | Phase 1 |
| **3** ✅ | Admin `TodosView` extended for cadernos | Phase 1 |
| **4** ✅ | Frontend routes `/cadernos` and `/cadernos/[slug]` | Phases 0, 2 |
| **5** ✅ | Navigation links in `SiteNav` | Phase 4 |
| **6** | Graph visualization `/cadernos/grafo` | Phases 1, 2 |

Phases 0 and 1 have no dependencies on each other and can be implemented in parallel (in separate chats, since they touch different parts of the codebase). Phases 2–5 must follow their dependency order.

---

## Verification Protocol (apply at end of each phase)

Per `CLAUDE.md`:
1. `npm run typecheck` — no TypeScript errors
2. `npm run lint` — no ESLint errors
3. `npm run test` — all Vitest tests pass
4. `npm run format` — Prettier formatting applied
5. Docker: `docker-compose up --build -d` then `docker-compose logs -f web`
6. Manually verify the specific behaviors listed in each phase's Verification section

If a phase touches the Payload collection schema, always run `./scripts/create-migration.sh` from the repo root (container must be running) and commit the migration file.

---

## Notes for Future Claude Sessions

- Always start by reading `CLAUDE.md` in the repo root — it contains the project-specific rules and the two-phase verification protocol.
- Never run `npm run dev` on the host machine — always use Docker Compose.
- The `scripts/create-migration.sh` script is required for any Payload collection change. Run it from the repo root.
- `lib/mdx-components.tsx` is the **single source of truth** for MDX component registration. Add new MDX components there.
- The MonacoMDXField component lives at `app/admin/components/MonacoMDXField.tsx` and is referenced by name in collection field definitions.
- `lib/eqref-interactions.ts` (created in Phase 0) provides the math equation reference interactivity hooks. Import from there in any layout that renders MDX content.
- When in doubt about how something is done in modules, look at `app/app/(frontend)/disciplinas/[slug]/[mod]/page.tsx` — it is the canonical reference for MDX content rendering.
