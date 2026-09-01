# Kuara Content Authoring Guide

This guide is the authoritative reference for writing MDX content for Kuara modules. Content is authored in **MDX** (Markdown + JSX) and stored in the Payload CMS admin panel under each module's `content` field. The platform renders the same source in two distinct modes: **Text Mode** (`texto`) and **Presentation Mode** (`apresentacao`).

> **Note for AI authors:** Follow this guide precisely. Every component name, prop name, and prop value listed here maps directly to a registered component in the MDX pipeline. Do not invent component names or props that are not documented here.

---

## Table of Contents

1. [Two Rendering Modes](#1-two-rendering-modes)
2. [How Slides Are Created](#2-how-slides-are-created)
3. [All Available Components](#3-all-available-components)
   - [Callout](#callout)
   - [YouTube](#youtube)
   - [PDF](#pdf)
   - [KImage](#kimage)
   - [ExternalLink](#externallink)
   - [Download](#download)
   - [Code Blocks](#code-blocks)
   - [SlideCover](#slidecover)
   - [SlideSecondColumnContent](#slidesecondcolumncontent)
   - [PresentOnly / TextOnly / HideInPresentation](#presentonly--textonly--hideinpresentation)
   - [Question / Answer / Hint](#question--answer--hint)
   - [Cite](#cite)
   - [CiteTessela](#citetessela)
   - [CiteModule](#citemodule)
   - [RefFig](#reffig)
   - [RefEq](#refeq)
   - [Comment](#comment)
   - [Todo](#todo)
   - [Interactive](#8-interactive-blocks)
4. [Directive Shorthand Syntax](#4-directive-shorthand-syntax)
5. [Writing Math](#5-writing-math)
6. [Figure Numbering System](#6-figure-numbering-system)
7. [Best Practices](#7-best-practices)
8. [Interactive Blocks](#8-interactive-blocks)
9. [Full MDX Template](#9-full-mdx-template)

---

## 1. Two Rendering Modes

Every module is rendered from a single MDX source. The reader can toggle between modes using the button in the top-right corner of the page (desktop only; mobile always uses Text Mode).

| | Text Mode (`texto`) | Presentation Mode (`apresentacao`) |
|---|---|---|
| **Layout** | Scrollable document / article | Full-screen slide deck |
| **Navigation** | Scroll | Arrow keys, swipe, click |
| **`<PresentOnly>`** | Hidden | Visible |
| **`<TextOnly>`** | Visible | Hidden |
| **`<HideInPresentation>`** | Visible | Hidden |
| **Two-column layout** | Stacked / inline | Side-by-side |
| **`<SlideCover>`** | Styled hero section | Full-screen title slide |
| **Mobile** | Always active | Not available |

**Design principle:** write your content once. Use `<PresentOnly>` and `<TextOnly>` only when you genuinely need different wording or visual emphasis — not to duplicate content.

---

## 2. How Slides Are Created

You never manually wrap content in `<Slide>` tags. The platform automatically splits the content into slides using headings as dividers.

### Automatic slide splitting

Every `# H1`, `## H2`, `### H3`, or `#### H4` heading starts a new slide. The heading text becomes the slide title shown in the header and progress bar.

```markdown
# Introduction

This is the first slide.

## What is Kuara?

This is the second slide.

### Key concepts

Third slide.
```

### Manual slide break

Use `<SlideBreak />` when you want a new slide without a visible heading:

```mdx
## Slide with two visual screens

First screen content.

<SlideBreak />

Second screen content — same heading, new slide.
```

### Preventing a slide break at a heading

Use `<SkipBreak />` immediately before a heading to keep it attached to the previous slide instead of starting a new one:

```mdx
## Main slide

This content stays here.

<SkipBreak />
### This subheading does NOT start a new slide — it stays in the same slide above.
```

### Cover slide

Place a `<SlideCover>` at the very top of your document to create a title card shown as the first slide:

```mdx
<SlideCover
  title="Introduction to Ecology"
  subtitle="Module 1 — Biofloresta"
  author="Prof. Ana Lima"
  date="2026-03-17"
  backgroundImage="https://example.com/cover.jpg"
  backgroundMaskOpacity="40%"
  logoImage="https://example.com/logo.png"
/>

# First content slide
```

> In Text Mode, `<SlideCover>` renders as a styled hero section at the top of the page. In Presentation Mode it fills the first slide entirely.

---

## 3. All Available Components

### Callout

Highlighted boxes to draw attention. Four types available (UI labels are in Portuguese):

```mdx
:::note
General information or clarification. (Label: **Nota**)
:::

:::tip
A helpful hint or shortcut. (Label: **Dica**)
:::

:::warning
Something the reader should be careful about. (Label: **Atenção**)
:::
```

For critical danger callouts, use the JSX form directly (no directive alias exists for `danger`):

```mdx
<Callout type="danger">
Critical information — errors, data loss risks, etc. (Label: **Perigo**)
</Callout>
```

| Type | UI Label | Icon | Accent Color |
|------|----------|------|-------------|
| `note` | Nota | Info | Blue |
| `tip` | Dica | Lightbulb | Emerald |
| `warning` | Atenção | AlertTriangle | Amber |
| `danger` | Perigo | AlertOctagon | Red |

Callouts support full Markdown inside them, including **bold**, lists, math, and links.

---

### YouTube

Embed a YouTube video. You can use the full URL or just the 11-character video ID:

```mdx
<YouTube url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />

<!-- Or use the ID directly -->
<YouTube id="dQw4w9WgXcQ" title="Video title for accessibility" />

<!-- Short URLs also work -->
<YouTube url="https://youtu.be/dQw4w9WgXcQ" />

<!-- Start at a specific time (in seconds) -->
<YouTube id="dQw4w9WgXcQ" start={120} />
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `url` | string | Full YouTube URL (any standard format) |
| `id` | string | 11-character video ID or any YouTube URL |
| `title` | string | Accessibility label (recommended) |
| `start` | number | Start time in seconds |

> In print/PDF mode, the embed is replaced with a plain text link.

---

### PDF

Embed a PDF document inline with a scrollable, zoomable viewer:

```mdx
<PDF src="/uploads/research-paper.pdf" title="Research Paper 2024" />

<!-- Using url prop (equivalent) -->
<PDF url="https://example.com/doc.pdf" title="External Document" />
```

**Responsive width via `title` directives** — embed sizing instructions directly in the `title` string:

```mdx
<!-- 50% width on small screens, 100% on large screens -->
<PDF src="/uploads/doc.pdf" title="My Document wsm=50 wlg=100" />

<!-- Alternative syntax -->
<PDF src="/uploads/doc.pdf" title="My Document size=50,100" />
```

The viewer supports zoom (0.5×–3×), drag to pan when zoomed, and a page counter.

> In print/PDF mode, the embed is replaced with a plain text link.

---

### KImage

The recommended way to insert images. `KImage` adapts automatically to each rendering mode, supports captions, figure numbering, and cross-references.

```mdx
<KImage
  src="/uploads/diagram.png"
  alt="System architecture diagram"
  caption="Figure caption shown below the image."
  width={500}
  widthPresentation={700}
  align="center"
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `src` / `url` | string | Image path or URL |
| `alt` | string | Alt text for accessibility (required) |
| `caption` | string | Plain-text caption below the image |
| `children` | ReactNode | Rich caption (JSX, e.g. with `<Cite>`). Takes priority over `caption`. |
| `label` | string | Figure label for auto-numbering and cross-reference anchor (`id="fig-{label}"`) |
| `width` | number \| string | Width in Text Mode (number = px; strings like `"50%"` also accepted) |
| `widthPresentation` | number \| string \| `"auto"` | Width in Presentation Mode. `"auto"` fills the slide height intelligently. |
| `align` | `"left"` \| `"center"` \| `"right"` | Horizontal alignment (default: `"center"`) |

**When to use `widthPresentation="auto"`:** for diagrams or full-height images in presentation slides. The component measures the available slide height/width at render time and sizes the image to fit without overflowing.

```mdx
<!-- Fills slide height automatically in presentation mode -->
<KImage
  src="/uploads/tall-chart.png"
  alt="Annual data chart"
  width={400}
  widthPresentation="auto"
/>
```

**Figure numbering:** set `label` to auto-number the figure (Fig. 1, Fig. 2…) and make it referenceable with `<RefFig>`:

```mdx
<KImage
  src="/uploads/cell.png"
  alt="Cell structure"
  caption="Cross-section of a eukaryotic cell."
  label="cell-structure"
  width={500}
  widthPresentation="auto"
/>

<!-- Elsewhere in the document -->
As shown in <RefFig label="cell-structure" />, the nucleus contains…
```

---

### ExternalLink

A styled card that links to an external resource. Preferred over raw hyperlinks for important references:

```mdx
<ExternalLink
  url="https://www.example.com"
  title="Official Documentation"
  description="The complete reference guide for the library."
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `url` | string | The destination URL |
| `title` | string | Link title (default: "Link Externo") |
| `description` | string | One-line description shown below the title |

---

### Download

A download button for files hosted on the platform:

```mdx
<Download
  url="/uploads/worksheet.pdf"
  filename="worksheet.pdf"
  label="Download Worksheet"
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `url` | string | File URL |
| `filename` | string | Filename shown and passed to browser's `download` attribute |
| `label` | string | Button label (default: "Download de Arquivo") |

---

### Code Blocks

Use standard fenced code blocks with a language tag. Syntax highlighting and a copy-to-clipboard button are added automatically:

````markdown
```python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b
```

```javascript
const sum = (a, b) => a + b;
```

```bash
docker-compose up --build -d
```
````

Supported languages include: `python`, `javascript`, `typescript`, `bash`, `json`, `yaml`, `sql`, `css`, `html`, `markdown`, and many more (powered by highlight.js).

---

### SlideCover

Full-screen cover slide. All props:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | No | Main title (defaults to module title if omitted) |
| `subtitle` | string | No | Subtitle line |
| `author` | string | No | Presenter name |
| `date` | string | No | Date string (e.g. `"2026-03-17"`) |
| `backgroundImage` | string | No | URL of background image |
| `backgroundMaskOpacity` | string | No | Darkening overlay, e.g. `"40%"` |
| `backgroundMaskBlur` | string | No | Blur amount applied to background, e.g. `"4px"` |
| `logoImage` | string | No | URL of a logo shown in the top-right corner |

> `<SlideCover>` must be the very first element in the document.

---

### SlideSecondColumnContent

Creates a two-column layout within a slide. In Text Mode, the second column stacks below the first (or is hidden if `textModeVisible={false}`). In Presentation Mode, it becomes a true side-by-side column.

```mdx
## Two-column slide

This is the **left column** content. Write the main explanation here.

<SlideSecondColumnContent width="45%">

This is the **right column**. Great for an image, a code example, or key bullet points.

<KImage src="/uploads/example.png" alt="Example" widthPresentation="auto" />

</SlideSecondColumnContent>
```

The left column takes the remaining width (here, 55%). Use percentages or pixel values for `width`.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `width` | string | CSS width of the right column (default: `"50%"`) |
| `textModeVisible` | boolean \| `"false"` | Set to `false` to hide the right column in Text Mode (default: `true`) |

> `<SlideSecondColumnContent>` must stay inside the same heading section as its paired left content. Never cross a heading boundary.

---

### PresentOnly / TextOnly / HideInPresentation

Render content conditionally based on the active mode. Use sparingly.

```mdx
<PresentOnly>

**Speaker note:** emphasise the third point when presenting.

</PresentOnly>

<TextOnly>

> For deeper reading, see the references section at the end of this module.

</TextOnly>

<HideInPresentation>

This paragraph is visible in Text Mode and hidden in Presentation Mode.
Functionally identical to TextOnly.

</HideInPresentation>
```

| Component | Text Mode | Presentation Mode |
|-----------|-----------|-------------------|
| `<PresentOnly>` | Hidden | Visible |
| `<TextOnly>` | Visible | Hidden |
| `<HideInPresentation>` | Visible | Hidden |

The directive shorthand also works (see [Section 4](#4-directive-shorthand-syntax)):

```markdown
:::present-only
Visible only in presentation mode.
:::

:::text-only
Visible only in text mode.
:::
```

---

### Question / Answer / Hint

A numbered, collapsible exercise system. Questions are auto-numbered per type within the page.

```mdx
<Question type="exercise" title="Calculating Entropy">

Given a system with 4 microstates of equal probability, calculate the entropy.

<Hint>

Use Boltzmann's formula: $S = k_B \ln(\Omega)$.

</Hint>

<Answer>

$S = k_B \ln(4) \approx 1.38 \times 10^{-23} \times 1.386 \approx 1.91 \times 10^{-23}\ \text{J/K}$

</Answer>

</Question>
```

**`<Question>` Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `"exercise"` \| `"example"` \| `"problem"` \| `"definition"` | `"exercise"` | Determines label, icon, and color scheme |
| `title` | string | — | Title shown in the question header |
| `initialState` | `"expanded"` \| `"contracted"` | `"contracted"` | Whether the answer is shown on load |

**Type reference:**

| Type | UI Label | Icon | Answer Button | Border Color |
|------|----------|------|--------------|--------------|
| `exercise` | Exercício | Pencil | "Ver resposta" | Primary |
| `example` | Exemplo | FlaskConical | "Ver solução" | Secondary |
| `problem` | Problema | Target | "Ver solução" | Clay |
| `definition` | Definição | BookMarked | "Ver detalhes" | Accent |

**`<Hint>` and `<Answer>` sub-components:**
- Must be placed as direct children of `<Question>`.
- `<Hint>` always starts collapsed regardless of `initialState`.
- `<Answer>` respects the parent's `initialState`.
- Both support full MDX inside (math, images, code, callouts).

---

### Cite

Inline citation that renders as a superscript number or author-year reference. Clicking opens a popover with the full bibliography entry.

```mdx
<!-- Single citation -->
The theory was first proposed by Darwin <Cite label="darwin1859" />.

<!-- Multiple citations -->
Several studies confirm this <Cite labels={["smith2020", "jones2021"]} />.
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `label` | string | Single bibliography key |
| `labels` | string[] | Multiple bibliography keys |

> Citation data (bibliography entries) must be configured in the module's metadata in the CMS. If a key is not found, the component renders `[key?]`.

---

### CiteTessela

Inline cross-reference to another Tessela (knowledge unit) in the platform. Hovering shows a popover with the tessela's title, abstract, and status badge.

```mdx
This concept is developed further in <CiteTessela slug="fotossintese-basica" />.

<!-- Custom display text -->
See <CiteTessela slug="fotossintese-basica" label="the photosynthesis module" /> for details.
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `slug` | string | The tessela's URL slug |
| `label` | string | Custom display text (default: tessela title) |

---

### CiteModule

Inline cross-reference to another Module or Course. Hovering shows a popover with the module's title and type badge.

```mdx
For background, review <CiteModule slug="intro-biologia" />.

<!-- Custom display text -->
Check the <CiteModule slug="intro-biologia" label="introductory module" /> first.
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `slug` | string | The module's URL slug |
| `label` | string | Custom display text (default: module title) |

---

### RefFig

Inline reference to a numbered figure. Hovering shows a thumbnail preview; clicking smooth-scrolls to the figure and briefly highlights it.

```mdx
As illustrated in <RefFig label="cell-structure" />, the mitochondria…
```

The `label` must match the `label` prop of a `<KImage>` defined somewhere in the same document. If not found, renders `[Fig.?]`.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `label` | string | Must match a `<KImage label="...">` in the same document |

---

### RefEq

Inline reference to a numbered equation — the equation counterpart of `<RefFig>`.
Hovering shows a preview of the equation; clicking smooth-scrolls to it and
briefly highlights it. It renders as "Eq. N", styled exactly like "Fig. N".

```mdx
$$
\begin{equation}
  E = mc^2 \label{eq:einstein}
\end{equation}
$$

Substituting into <RefEq label="eq:einstein" /> gives…
```

The `label` must match a `\label{...}` inside a numbered AMS environment in the
same document. The `eq:` prefix is optional — `label="einstein"` and
`label="eq:einstein"` both resolve to `\label{eq:einstein}`. If not found,
renders `[Eq.<label>?]`.

The number is the one MathJax assigned, so unlabelled equations still take up a
number: an unlabelled `\begin{equation}` between two labelled ones makes the
second labelled equation Eq. 3, not Eq. 2.

> The older `$\eqref{eq:...}$` syntax still works and still renders "(N)", but
> `<RefEq>` is preferred for new content — it reads as "Eq. N" and matches the
> figure references.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `label` | string | Must match a `\label{...}` on a numbered equation in the same document |

---

### Comment

Renders nothing. Use for author-only notes that should never appear to readers.

```mdx
<Comment>
TODO: verify this statistic with the 2025 report before publishing.
</Comment>
```

---

### Todo

Renders nothing to readers. Author TODOs are indexed in the Payload CMS admin panel at `/payload/todos` for tracking.

```mdx
<Todo>Add a diagram illustrating the nitrogen cycle here.</Todo>
```

---

## 4. Directive Shorthand Syntax

> **Authoring rule: always prefer JSX over directives.** Write `<Callout type="tip">` instead of `:::tip`, `<PresentOnly>` instead of `:::po`, and so on. JSX is explicit, unambiguous, and consistent with every other component in this guide. Directives exist for human convenience in quick edits — AI-generated content should use JSX throughout.

Some components have a `:::` directive alias for completeness. The mapping is:

| Directive | Equivalent JSX (preferred) |
|-----------|---------------------------|
| `:::note` | `<Callout type="note">` |
| `:::tip` | `<Callout type="tip">` |
| `:::warning` | `<Callout type="warning">` |
| `:::present-only` or `:::po` | `<PresentOnly>` |
| `:::text-only` or `:::to` | `<TextOnly>` |
| `:::slide{layout="..."}` | `<Slide layout="...">` |

> **Important:** `:::danger` does NOT have a directive alias. Use `<Callout type="danger">` directly.

**Do this:**

```mdx
<Callout type="tip">
Use JSX components for all authoring. They are explicit and consistent.
</Callout>

<PresentOnly>
This is a speaker note — only visible during presentation.
</PresentOnly>

<TextOnly>
This expanded paragraph only appears in the text reading view.
</TextOnly>
```

**Not this:**

```markdown
:::tip
Avoid directive shorthand in authored content.
:::

:::po
Prefer the JSX form above.
:::
```

---

## 5. Writing Math

Math is rendered via MathJax with AMS support. Use standard LaTeX delimiters:

```markdown
Inline math: $E = mc^2$

Display math:
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

AMS environments are supported:

```markdown
$$
\begin{align}
  \nabla \cdot \mathbf{E} &= \frac{\rho}{\varepsilon_0} \\
  \nabla \times \mathbf{B} &= \mu_0 \mathbf{J}
\end{align}
$$
```

Math can be used inside Callouts, Question/Answer/Hint blocks, and captions.

**Numbered equations.** A `\label{...}` inside a numbered AMS environment makes
the equation referenceable from anywhere in the document with `<RefEq>`, which
renders an inline "Eq. N" link — see [RefEq](#refeq).

```markdown
$$
\begin{equation}
  E = mc^2 \label{eq:einstein}
\end{equation}
$$

Substituindo em <RefEq label="eq:einstein" /> obtemos…
```

---

## 6. Figure Numbering System

The platform provides an automatic figure numbering system. When `label` is set on a `<KImage>`, the image is registered with an auto-incremented number (Fig. 1, Fig. 2, …) and can be referenced from anywhere in the document with `<RefFig>`.

**Rules:**
- Figures are numbered in the order they appear in the source document.
- The `label` must be unique within a module.
- `<RefFig label="...">` renders an inline link ("Fig. N") with a hover thumbnail preview.
- Clicking a `<RefFig>` smooth-scrolls to the figure and flashes a highlight.

**Example:**

```mdx
## Cell Structure

<KImage
  src="/uploads/cell.png"
  alt="Eukaryotic cell diagram"
  caption="Cross-section of a eukaryotic cell showing major organelles."
  label="eukaryotic-cell"
  width={520}
  widthPresentation="auto"
/>

## Mitochondria

The powerhouse of the cell (see <RefFig label="eukaryotic-cell" />) contains…
```

**Rich captions with citations:**

```mdx
<KImage
  src="/uploads/spectrum.png"
  alt="Absorption spectrum"
  label="absorption-spectrum"
  width={480}
  widthPresentation={600}
>
  Absorption spectrum of chlorophyll a and b <Cite label="stryer2002" />.
</KImage>
```

When `children` are provided to `<KImage>`, they are used as the caption instead of the `caption` prop.

---

## 7. Best Practices

### Document structure

- **Use `# H1` for major topics** — each becomes a standalone slide and a top-level sidebar entry.
- **Use `## H2` for sub-topics** within a major section.
- **Use `### H3` for supporting detail slides** under an H2.
- Avoid going deeper than H3/H4 — it creates too many slides and fragments the content.
- Keep each slide focused on one idea. If a slide feels crowded, split it with `<SlideBreak />`.

### Writing for both modes simultaneously

The fundamental authoring pattern for every section is: **text prose and slide bullets travel together, side by side, followed by any shared resources.**

**Text content (`<TextOnly>`)** is written in continuous didactic and technical prose — complete sentences, paragraphs, explanations in depth. This is the reading experience.

**Slide content (`<PresentOnly>`)** reflects exactly the same ideas but restructured as short, objective bullet points — one idea per bullet, no full sentences needed. This is the presentation experience.

**Shared resources** (images, videos, diagrams, code blocks) are placed **outside both wrappers**, immediately after them, so they appear in both modes without duplication.

```mdx
## A seção começa aqui

<TextOnly>
A automação industrial evoluiu significativamente desde a Revolução Industrial,
acompanhando os avanços tecnológicos e a crescente demanda por eficiência e
controle nos processos produtivos. O controle era essencialmente manual nos
primeiros sistemas. Com o surgimento da eletrônica e da computação, a automação
ganhou novas camadas de sofisticação, culminando no desenvolvimento de sistemas
dedicados à supervisão remota — os sistemas SCADA, consolidados a partir da
década de 1970 como ferramentas essenciais na indústria moderna.
</TextOnly>

<PresentOnly>
- A automação evoluiu significativamente desde a Revolução Industrial
- Controle originalmente manual, realizado por operadores em campo
- Eletrônica e software viabilizaram sistemas supervisórios centralizados
- SCADA se consolidou a partir dos anos 1970
</PresentOnly>

<KImage
  src="/uploads/scada-evolution.png"
  alt="Linha do tempo da evolução dos sistemas SCADA"
  caption="Evolução histórica dos sistemas de supervisão industrial."
  label="scada-evolution"
  width={520}
  widthPresentation="auto"
/>
```

**Rules:**
- Never separate the `<TextOnly>` and `<PresentOnly>` blocks for the same concept — keep them adjacent.
- Place shared resources (images, videos, downloads) after both blocks, never inside either wrapper.
- If a resource is purely for visual aid in slides and adds nothing to reading (e.g. a decorative layout diagram), it may go inside `<PresentOnly>`. Otherwise, keep it shared.
- The slide bullets are a distillation, not a copy — rephrase into fragments, remove conjunctions and filler words.

### Slide density

Each slide should be scannable in a few seconds. Respect these limits:

- **Maximum 5–6 bullet points per slide.** If you have more, split with `<SlideBreak />` or create a new sub-heading.
- **Maximum 8–10 words per bullet.** Strip articles, conjunctions, and filler. "A eletrônica viabilizou sistemas supervisórios centralizados" beats "Foi a partir dos avanços da eletrônica que tornou-se possível desenvolver sistemas supervisórios centralizados".
- **One idea per bullet.** Do not use semicolons or commas to chain two ideas into one bullet.
- Math equations, code blocks, and images each count as the full content of a slide — do not pair them with a long bullet list.

### Mode-agnostic components

The following components **work well in both modes** and must be placed **outside** `<TextOnly>` and `<PresentOnly>` wrappers, as shared content:

| Component | Reason |
|-----------|--------|
| `<KImage>` | Adapts its width automatically per mode |
| `<YouTube>` | Embeds in both; shows a plain link in print |
| `<PDF>` | Embeds in both; shows a plain link in print |
| `<Download>` | Relevant in both modes |
| `<ExternalLink>` | Relevant in both modes |
| `<Question>` / `<Answer>` / `<Hint>` | Interactive in both; collapses cleanly in slides |
| `<Callout>` | Highlights key information in both modes |
| Math (`$$...$$`) | Renders in both modes |
| Code blocks | Render in both modes |

Only wrap a resource inside `<PresentOnly>` when it is purely a visual aid with no reading value (e.g. a decorative background diagram). Only wrap it inside `<TextOnly>` when it would be disruptive or meaningless in a slide (e.g. a long reference table).

### Links: inline vs. `<ExternalLink>`

There are two ways to link to external content — use each for a different purpose:

- **Inline Markdown link** `[texto](url)` — for references woven into the prose. Opens in a new tab automatically. Use inside `<TextOnly>` paragraphs or anywhere a hyperlink fits naturally in a sentence.

  ```mdx
  Para mais detalhes, consulte a [documentação oficial do protocolo Modbus](https://modbus.org).
  ```

- **`<ExternalLink>` component** — for featured references that deserve visual prominence: recommended readings, official docs, key tools. Place it outside prose, as a standalone block.

  ```mdx
  <ExternalLink
    url="https://modbus.org"
    title="Documentação Oficial Modbus"
    description="Especificações completas do protocolo Modbus para integração industrial."
  />
  ```

Never use `<ExternalLink>` inside running text, and never use a raw Markdown link where a featured reference card is more appropriate.

### Images

- Always supply an `alt` text.
- Use `align="center"` for standalone diagrams, `align="left"` or `align="right"` when floating next to text.
- Set `width` for a comfortable text-mode reading size and `widthPresentation` (or `widthPresentation="auto"`) for the slide.
- Prefer `widthPresentation="auto"` for diagrams inside slides — it prevents overflow.
- Use `label` whenever you expect to reference the figure elsewhere in the document.

### Two-column layouts

- Keep both columns proportional — a very long left column beside a tiny right column looks awkward.
- The right column is ideal for: a supporting image, a concise code snippet, a short bullet list, or a callout.
- Use `textModeVisible={false}` on `<SlideSecondColumnContent>` only when the right-column content makes no sense outside a slide (e.g. a layout diagram that only works visually).

### Question / Exercise system

- Use `type="example"` for worked examples that explain a concept step by step.
- Use `type="exercise"` for problems the student solves themselves.
- Use `type="problem"` for harder or open-ended challenges.
- Use `type="definition"` for formal definitions.
- Always provide a `<Hint>` when the exercise is non-trivial.
- Set `initialState="expanded"` on `<Question>` only for definitions or examples where seeing the answer immediately is the point.

### Citations and cross-references

- Always cite sources for data, diagrams, and direct quotes using `<Cite>`.
- Use `<CiteTessela>` and `<CiteModule>` to link related content within the platform.
- Keep `<RefFig>` references to figures that are in the same document.

### YouTube and PDF

- Always add a `title` prop for accessibility.
- `<YouTube>` expands to fill its container; no need to specify dimensions.
- For `<PDF>`, use the `title` sizing directives to prevent the viewer from being too wide on large screens.

### No raw HTML

Only use standard Markdown syntax and the registered components listed in this guide. Do not write raw HTML tags such as `<div>`, `<span>`, `<img>`, `<br>`, `<table>`, `<style>`, or any other HTML element directly in the MDX source.

| Instead of… | Use… |
|-------------|------|
| `<img src="..." />` | `<KImage src="..." alt="..." />` |
| `<a href="...">text</a>` | `[text](url)` or `<ExternalLink>` |
| `<br />` (forced line break) | A blank line (new paragraph) |
| `<table>…</table>` | Markdown table (`\| col \| col \|`) |
| `<b>`, `<i>`, `<em>` | `**bold**`, `_italic_` |

Raw HTML bypasses the rendering pipeline and may produce unstyled, inaccessible, or broken output in both modes.

---

## 8. Interactive Blocks

An **interactive block** embeds a small self-contained application into the middle of the content — a 3D scene the student can rotate, a calculator, a responsive quiz. It behaves like a framed `iframe`, but renders as a first-class part of the page: same theme, same typography, same print pipeline.

Every interactive block is written with the **same component**, `<Interactive>`, and selects a widget from the Kuara catalogue by id:

```mdx
<Interactive widget="coord-frame-3d" point="1.5,1,0.8" pointLabel="P">
Um ponto \(P\) descrito no sistema de coordenadas \(\{A\}\). Arraste para girar.
</Interactive>
```

### Inserting one

In the module editor, the toolbar's **Interativos** group opens a menu of the catalogue: each entry shows the widget's drawing, its name and its id, and choosing one inserts the block ready to edit. If you had text selected, that text becomes the block's caption.

The same snippets are listed in the admin's widget library at `/payload/interativos`, with each widget's parameters and a copy button.

### How it works

- **`widget`** (required) names an entry in the catalogue below. An unknown id renders a contained error box listing the valid ids — it never blanks the module.
- **The block body is the caption.** It appears under the widget on screen, and stands in for the widget when the page is printed.
- **Every other attribute is passed to the widget** and validated against that widget's declared parameters. A rejected or misspelled parameter is reported in an amber strip above the block rather than being silently dropped, so authoring mistakes are visible in the preview.

### Box-level parameters

These work on every widget, regardless of which one you chose:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `widget` | `string` | — | **Required.** Catalogue id, e.g. `coord-frame-3d`. |
| `title` | `string` | widget's title | Overrides the heading shown in the block's header bar. |
| `height` | `number` | widget's default | Stage height in px, clamped to 160–900. Presentation mode caps it further so the block fits a slide. |
| `poster` | `string` | — | Image printed in place of the live widget (e.g. `/media/frame.png`). Only needed to override what the widget already prints — see below. |

### Behaviour in the other modes

- **Presentation mode:** the block renders normally, but its height is capped against the viewport so the surrounding slide text stays visible.
- **Print / PDF:** a WebGL canvas prints as a blank rectangle, so the block substitutes a static version, in this order:
  1. the `poster` image, if the author supplied one;
  2. the widget's own **vector drawing** — an SVG rendered from the same camera as the live scene, so it prints crisp at any zoom and needs no uploaded asset (every catalogued widget ships one, and it honours that instance's parameters);
  3. failing both, the title and caption alone, the same treatment `<YouTube>` gets.

  In practice you should not need `poster` at all for a widget that ships a vector drawing.

> Interactive blocks are **standalone blocks**, deliberately outside the figure-numbering system of §6. They carry no "Figure N" label and cannot be referenced with `<RefFig>`.

### Directive form

`:::interactive` exists as an alias, subject to the same rule as §4 — **prefer the JSX form**:

```markdown
:::interactive{widget="coord-frame-3d" grid=false}
Caption here.
:::
```

Remember that directive attributes are always strings: `grid=false` and `grid="false"` are equivalent, and a bare `{grid}` means `grid=true`.

### Widget catalogue

<!-- BEGIN:interactive-catalog -->

<!-- Generated by scripts/gen-interactive-docs.mjs — do not edit by hand. -->

#### `coord-frame-3d` — Sistema de coordenadas 3D

Triedro cartesiano destro (x vermelho, y verde, z azul) que o aluno rotaciona com o mouse. Os botões 1D/2D/3D no cabeçalho alternam entre a reta, o plano e o espaço. Opcionalmente marca um ponto e projeta suas coordenadas sobre os eixos.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `labels` | `boolean` | `true` | Exibe os rótulos x̂, ŷ, ẑ nas pontas dos eixos e o na origem. |
| `grid` | `boolean` | `true` | Desenha a graduação de referência: a malha sobre o plano xy em 2D/3D e a régua sobre a reta em 1D. Cada quadrado (ou divisão) mede exatamente um vetor de base. |
| `frameName` | `string` | `A` | Nome do frame. Não aparece nos rótulos desenhados; descreve a figura para leitores de tela. |
| `point` | `"x,y,z"` | — | Coordenadas de um ponto a marcar, no formato "x,y,z" (ex.: "1.5,1,0.8"). |
| `pointLabel` | `string` | `P` | Rótulo do ponto marcado. |
| `projections` | `boolean` | `true` | Traça as linhas tracejadas do ponto até os eixos (só com `point`). |
| `autoRotate` | `boolean` | `false` | Gira a cena lentamente até o aluno interagir. |

```mdx
<Interactive widget="coord-frame-3d" height="420">
Caption shown below the block, and in place of it when printing.
</Interactive>
```
#### `differential-drive` — Robô diferencial: medidas e variáveis

O chassi de um robô diferencial genérico, translúcido e girável, com todos os símbolos da modelagem escritos sobre aquilo que eles medem: o frame {R} na origem do eixo das rodas, o raio r, a bitola d entre os pontos de contato, a velocidade angular de cada roda (ω_l e ω_r) com a velocidade linear que ela produz (v_l e v_r), e as velocidades do chassi ao longo dos eixos em que são expressas (ẋ_R, ẏ_R = 0 pela restrição não-holonômica, e θ̇_R). Cada grupo de anotações pode ser desligado por parâmetro, para usar a mesma figura em pontos diferentes da aula.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `frameName` | `string` | `R` | Nome do frame do robô. Aparece no subscrito dos vetores de base (x̂_R) e das velocidades do chassi (ẋ_R). |
| `labels` | `boolean` | `true` | Exibe o triedro rotulado: x̂, ŷ e ẑ nas pontas dos eixos e a origem O do frame sobre o eixo das rodas. |
| `measures` | `boolean` | `true` | Exibe as medidas geométricas: a linha do raio r, do centro de cada roda até o seu bordo, e a linha de cota da bitola d entre os dois pontos de contato com o solo. |
| `wheelSpeeds` | `boolean` | `true` | Exibe o que cada roda faz: a velocidade angular ω_l e ω_r, como arcos em torno do eixo no sentido positivo (que rola a roda para a frente), e a velocidade linear resultante v_l e v_r, como setas para a frente. |
| `chassisSpeeds` | `boolean` | `true` | Exibe as velocidades do chassi expressas em {R}: ẋ_R para a frente, θ̇_R em torno de ẑ_R, e ẏ_R tracejada e anulada, que é a restrição não-holonômica. |
| `grid` | `boolean` | `true` | Desenha o piso graduado sob o robô. Cada quadrado mede uma unidade do mundo, servindo de escala para r e d. |
| `opacity` | `number` | `0.34` | Opacidade do chassi e das rodas. Valores baixos deixam ver o triedro e a linha de cota através do corpo; 1 desenha o robô sólido. |

```mdx
<Interactive widget="differential-drive" height="480">
Caption shown below the block, and in place of it when printing.
</Interactive>
```
#### `differential-kinematics` — Cinemática do robô diferencial

A Eq. (3) do módulo virada objeto manipulável, vista de cima. Dois sliders comandam as velocidades angulares das rodas (ω_l e ω_r) e o robô passa a se deslocar no plano com a velocidade linear e angular resultantes, deixando o rastro do caminho percorrido e o centro instantâneo de rotação em que ele gira. O painel mostra a mesma conta em forma matricial, com os números correntes. Os botões no cabeçalho invertem a relação: em ω→v os sliders são as rodas e o chassi obedece; em v→ω os sliders são as velocidades do chassi e as rodas recebem, pela fórmula inversa, o que precisam fazer para produzi-las. O bloco abre com o robô parado, e o botão reiniciar devolve tudo ao repouso: velocidades zeradas, robô na origem e rastro apagado.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `wheelRadius` | `number` | `0.05` | Raio r das rodas, em metros. Também define o desenho: as rodas vistas de cima têm exatamente 2r de comprimento, para que a figura nunca discorde dos números. |
| `track` | `number` | `0.3` | Bitola d, em metros — a distância entre os pontos de contato das rodas. Define a escala do robô inteiro e o alcance dos sliders do modo inverso. |
| `leftSpeed` | `number` | `0` | Velocidade angular inicial da roda esquerda, ω_l, em rad/s. Zero por padrão: o bloco abre com o robô parado, para que o primeiro movimento que o aluno vê seja o que ele mesmo comandou. Limitada a ±10 rad/s, o que o widget assume ser o limite dos motores. |
| `rightSpeed` | `number` | `0` | Velocidade angular inicial da roda direita, ω_r, em rad/s. Zero por padrão, pelo mesmo motivo de ω_l. Autore as duas com valores diferentes para que o bloco já abra descrevendo uma curva. |
| `trail` | `boolean` | `true` | Deixa o rastro do caminho percorrido no plano — a trajetória que a seção de odometria vai calcular depois. |
| `icr` | `boolean` | `true` | Marca o centro instantâneo de rotação, a uma distância v/ω sobre o eixo ŷ_R, e a circunferência que o robô descreve em torno dele. Some quando o caminho é reto, que é o centro no infinito. |
| `decimals` | `number` | `2` | Casas decimais dos números do painel. |
| `frameName` | `string` | `R` | Nome do frame do robô. Aparece nos rótulos dos eixos do chassi e no subscrito das velocidades. |
| `inertialName` | `string` | `I` | Nome do frame inercial fixo, marcado na origem do plano. |

```mdx
<Interactive widget="differential-kinematics" height="620">
Caption shown below the block, and in place of it when printing.
</Interactive>
```
#### `frame-mapping` — Mapeando de um frame para o outro

O mesmo ponto m, lido em dois frames. O aluno arrasta m pelo espaço e coloca {B} onde quiser em relação a {A} — transladando e girando — enquanto o painel instancia os três elementos da conta: ᴬp_m, ᴮR_A e ᴮp_A. Abaixo deles a expressão ᴮp_m = ᴮR_A ᴬp_m + ᴮp_A é montada com esses números e resolvida em duas etapas, a rotação primeiro e a soma depois, exatamente como se faz no papel. O detalhe que a figura torna visível é que ᴮp_A não é o simétrico da posição de {B}: é aquele deslocamento resolvido nos eixos de {B}, e por isso ele muda quando só a rotação muda. Os botões 2D/3D alternam entre o plano do exemplo da seção, onde há um único ângulo, e o espaço, com os três — que é onde o bloco abre.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `point` | `"x,y,z"` | `"4,3,2"` | Posição inicial do ponto m, escrita em {A} — o ᴬp_m da conta, no formato "x,y,z". Cada componente é limitada à faixa dos sliders (-7 a 7). |
| `framePosition` | `"x,y,z"` | `"5,2,0"` | Onde a origem de {B} começa, medida em {A} (ᴬp_B), no formato "x,y,z". É a pose que o aluno enxerga; o ᴮp_A do painel é derivado dela. Limitada à faixa dos sliders (-7 a 7). |
| `angles` | `"x,y,z"` | `"0,0,-180"` | Orientação inicial de {B} em relação a {A}, em graus, no formato "α,β,γ" — as rotações em torno dos eixos fixos x, y e z de {A}, nessa ordem. No modo 2D só γ é usado. |
| `step` | `number` | `5` | Incremento dos sliders angulares, em graus. Use 15, 30 ou 90 para ângulos notáveis. |
| `positionStep` | `number` | `1` | Incremento dos sliders de posição, em vetores de base. O padrão é 1, que mantém m e {B} sobre os nós da malha e as contas em números inteiros. |
| `decimals` | `number` | `1` | Casas decimais das entradas do painel. |
| `referenceName` | `string` | `A` | Nome do frame de referência, onde m é conhecido. |
| `targetName` | `string` | `B` | Nome do frame de destino, para o qual m é mapeado. |
| `pointLabel` | `string` | `m` | Nome do ponto. Aparece no subscrito dos vetores. |
| `labels` | `boolean` | `true` | Exibe os rótulos x̂, ŷ, ẑ (com o subscrito do frame) nas pontas dos eixos, o nome de cada origem, o do ponto e o de cada vetor. |
| `grid` | `boolean` | `true` | Desenha a malha de referência sobre o plano xy de {A}. Cada quadrado mede exatamente um vetor de base, que é a unidade de todos os sliders de posição. |

```mdx
<Interactive widget="frame-mapping" height="620">
Caption shown below the block, and in place of it when printing.
</Interactive>
```
#### `homogeneous-transform` — Transformação homogênea

A pose completa de um frame: {R} gira com três sliders angulares e se desloca com três sliders de posição, enquanto o painel monta, entrada por entrada, a matriz ᴵT_R. As quatro colunas são pintadas como no texto — a rotação ᴵR_R no bloco 3×3, a translação ᴵp_R na última coluna e a linha [0 0 0 1] embaixo, apenas para fechar o quadrado. Girar sem transladar mexe só no bloco esquerdo; transladar sem girar mexe só na última coluna, que é o argumento visual de que a matriz não é um objeto novo, e sim dois já conhecidos escritos lado a lado. Como em `rotation-matrix`, a chave `proprio` transforma os sliders angulares numa sequência: cada um gira {R} em torno do próprio eixo a partir de onde o frame está, volta a zero quando solto e deixa um triedro fantasma marcando o passo — os sliders de posição continuam absolutos, porque uma translação não perde o seu eixo. Dois botões desfazem: “alinhar eixos” zera os ângulos sem mexer na posição (o bloco 3×3 vai à identidade e a última coluna fica parada), e “redefinir” devolve a pose inicial inteira.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `angles` | `"x,y,z"` | `"0,0,30"` | Ângulos iniciais em graus, no formato "α,β,γ" — as rotações em torno de x, y e z, nessa ordem. Cada um é limitado à faixa dos sliders (-180 a 180). |
| `position` | `"x,y,z"` | `"1.2,0.8,0.6"` | Translação inicial ᴵp_R, no formato "x,y,z", medida em vetores de base (um quadrado da malha). Limitada à faixa dos sliders (-2 a 2). O padrão já afasta {R} da origem, para que os dois triedros não nasçam sobrepostos. |
| `mode` | `inercial` \| `proprio` | `inercial` | Posição inicial da chave: `inercial` gira {R} em torno dos eixos fixos de {I}, com três ângulos absolutos; `proprio` gira em torno dos eixos do próprio {R}, como uma sequência de passos com fantasmas. |
| `step` | `number` | `5` | Incremento dos sliders angulares, em graus. Use 15 ou 30 para ângulos notáveis. |
| `positionStep` | `number` | `0.1` | Incremento dos sliders de translação, em vetores de base. Use 0.5 ou 1 para posições sobre os nós da malha. |
| `decimals` | `number` | `2` | Casas decimais das entradas da matriz. |
| `inertialName` | `string` | `I` | Nome do frame inercial (o fixo). |
| `rotatedName` | `string` | `R` | Nome do frame que gira e se desloca. |
| `labels` | `boolean` | `true` | Exibe os rótulos x̂, ŷ, ẑ (com o subscrito do frame) nas pontas dos eixos, o nome de cada origem e o do vetor de translação. |
| `grid` | `boolean` | `true` | Desenha a malha de referência sobre o plano xy de {I}. Cada quadrado mede exatamente um vetor de base, que é a unidade dos sliders de translação. |

```mdx
<Interactive widget="homogeneous-transform" height="620">
Caption shown below the block, and in place of it when printing.
</Interactive>
```
#### `inertial-odometry` — Velocidades e odometria no frame inercial

O robô diferencial visto de cima, agora com o frame inercial {I} fixo no centro do plano: a câmera não acompanha o robô, ela abre à medida que ele se afasta, para que a origem contra a qual tudo é medido nunca saia de vista. Os sliders comandam as rodas (ω_l e ω_r) ou, pelos botões do cabeçalho, diretamente as velocidades do chassi. Enquanto o robô anda, o painel mostra as duas contas da seção: a transformada que leva ᴿξ̇_R para {I}, com a matriz de rotação preenchida pelo θ corrente, e o somatório discreto que acumula a pose ᴵξ_R(T) a partir dessas velocidades. Na cena aparecem o rastro do percurso, o vetor posição ᴵp_R, o ângulo θ entre os dois frames, as componentes ẋ_I e ẏ_I da velocidade, e — em traço pontilhado — a estimativa da odometria, que se descola do robô quanto maior for o passo Δt da integração.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `wheelRadius` | `number` | `0.05` | Raio r das rodas, em metros. Também define o desenho: as rodas vistas de cima têm exatamente 2r de comprimento. |
| `track` | `number` | `0.3` | Bitola d, em metros — a distância entre os pontos de contato das rodas. Define a escala do robô e o alcance dos sliders do modo inverso. |
| `leftSpeed` | `number` | `0` | Velocidade angular inicial da roda esquerda, ω_l, em rad/s. Zero por padrão: o bloco abre parado, para que o primeiro movimento seja o que o aluno comandou. |
| `rightSpeed` | `number` | `0` | Velocidade angular inicial da roda direita, ω_r, em rad/s. Zero por padrão, pelo mesmo motivo. |
| `step` | `number` | `0.1` | Passo Δt da integração da odometria, em segundos. É o Δt do somatório da seção: com 0,1 s a estimativa já se descola visivelmente do robô numa curva fechada, e valores maiores tornam o erro tão grande quanto o texto avisa. |
| `trail` | `boolean` | `true` | Desenha o rastro do percurso real do robô, em linha cheia, e o da estimativa da odometria, pontilhado. |
| `components` | `boolean` | `true` | Decompõe a velocidade do robô nas componentes ẋ_I e ẏ_I do frame inercial, como catetos tracejados sob a seta de velocidade — o conteúdo geométrico da transformada. |
| `decimals` | `number` | `2` | Casas decimais dos números do painel. |
| `frameName` | `string` | `R` | Nome do frame do robô. Aparece nos rótulos dos eixos do chassi e no subscrito das velocidades. |
| `inertialName` | `string` | `I` | Nome do frame inercial fixo, marcado na origem do plano. |

```mdx
<Interactive widget="inertial-odometry" height="680">
Caption shown below the block, and in place of it when printing.
</Interactive>
```
#### `position-vector` — Vetor de posição 3D

O vetor de posição de um ponto no espaço, traçado da origem do frame até o ponto. Sliders movem o ponto ao longo de cada eixo (de -5 a 5) e o painel mostra o vetor de coordenadas correspondente, tanto na forma matricial quanto como combinação dos vetores de base. Os botões 1D/2D/3D no cabeçalho alternam entre a reta, o plano e o espaço.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `point` | `"x,y,z"` | `"3,2,1"` | Posição inicial do ponto, no formato "x,y,z". Cada componente é limitada à faixa dos sliders (-5 a 5). |
| `pointLabel` | `string` | `r` | Nome do ponto. Aparece como o subscrito do vetor no painel (ᴵp_r) e ao lado do marcador. |
| `frameName` | `string` | `I` | Nome do frame de referência. Aparece como o sobrescrito do vetor no painel e no subscrito dos vetores de base (x̂_I). |
| `step` | `number` | `0.5` | Incremento dos sliders. Use 1 para coordenadas inteiras. |
| `labels` | `boolean` | `true` | Exibe os rótulos x̂, ŷ, ẑ nas pontas dos eixos, o na origem e o nome do ponto ao lado do marcador. |
| `grid` | `boolean` | `true` | Desenha a graduação de referência: a malha sobre o plano xy em 2D/3D e a régua sobre a reta em 1D. Cada quadrado mede exatamente um vetor de base. |
| `projections` | `boolean` | `true` | Traça as linhas tracejadas do ponto até os eixos, mostrando de onde vem cada coordenada. |

```mdx
<Interactive widget="position-vector" height="520">
Caption shown below the block, and in place of it when printing.
</Interactive>
```
#### `rotation-matrix` — Matriz de rotação

Dois sistemas de coordenadas de mesma origem — o inercial {I}, fixo, e {R}, que o aluno gira com três sliders (um por eixo). Uma chave seletora escolhe o que os sliders significam. Em `inercial` (extrínseca) eles são três ângulos absolutos em torno dos eixos fixos de {I}. Em `proprio` (intrínseca) cada slider gira {R} em torno do próprio eixo, a partir de onde o frame está, e volta a zero quando solto: a rotação vira um passo da sequência e deixa um triedro fantasma marcando por onde {R} passou. Assim o aluno pode girar duas vezes em torno do mesmo eixo e ver que, da segunda vez, esse eixo já não é o mesmo. O botão “alinhar eixos” zera tudo e apaga os fantasmas, e trocar de modo também. O painel exibe, a todo momento, a matriz de rotação ᴵR_R, cujas colunas são os vetores de base de {R} escritos em {I}. Os botões 1D/2D/3D no cabeçalho trocam a dimensão dos dois frames, e com ela quantas rotações existem: nenhuma na reta (ᴵR_R = [1]), uma no plano (em torno do ẑ que sai da página, onde as duas convenções coincidem) e três no espaço.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `angles` | `"x,y,z"` | `"0,0,30"` | Ângulos iniciais em graus, no formato "α,β,γ" — as rotações em torno de x, y e z, nessa ordem. Cada um é limitado à faixa dos sliders (-180 a 180). Nas vistas 1D e 2D, os ângulos cujo eixo não existe ali são lidos como zero. O padrão já deixa {R} levemente girado, para que os dois triedros não nasçam sobrepostos. |
| `mode` | `inercial` \| `proprio` | `inercial` | Posição inicial da chave: `inercial` gira {R} em torno dos eixos fixos de {I}; `proprio` gira em torno dos eixos do próprio {R}. Só aparece na vista 3D — com uma rotação só, as duas dão o mesmo resultado. |
| `step` | `number` | `5` | Incremento dos sliders, em graus. Use 15 ou 30 para ângulos notáveis. |
| `decimals` | `number` | `2` | Casas decimais das entradas da matriz. |
| `inertialName` | `string` | `I` | Nome do frame inercial (o fixo). |
| `rotatedName` | `string` | `R` | Nome do frame que gira. |
| `labels` | `boolean` | `true` | Exibe os rótulos x̂, ŷ, ẑ (com o subscrito do frame) nas pontas dos eixos e o na origem. |
| `grid` | `boolean` | `true` | Desenha a malha de referência sobre o plano xy de {I}. Cada quadrado mede exatamente um vetor de base. |

```mdx
<Interactive widget="rotation-matrix" height="560">
Caption shown below the block, and in place of it when printing.
</Interactive>
```

<!-- END:interactive-catalog -->

> **Adding a widget** is a code change, not a content change: add `app/components/interactive/widgets/<id>/` with a `meta.ts` and a component, register it in `catalog.ts` and `registry.ts`, then regenerate this section with `node scripts/gen-interactive-docs.mjs`. Give it a `PrintFallback` in the registry entry too — a plain SVG drawing of the same scene — so the widget prints as something other than its own title.

---

## 9. Full MDX Template

A complete example combining the most common patterns:

```mdx
<SlideCover
  title="Module 3: Photosynthesis"
  subtitle="Biofloresta — Environmental Sciences"
  author="Prof. Maria Silva"
  date="2026-03-17"
  backgroundImage="https://example.com/forest.jpg"
  backgroundMaskOpacity="35%"
/>

# What is Photosynthesis?

Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose <Cite label="taiz2015" />.

:::note
This process is fundamental to almost all life on Earth.
:::

<TextOnly>
For a detailed biochemical pathway, refer to the supplementary reading in the resources section.
</TextOnly>

## The Overall Reaction

The net equation for oxygenic photosynthesis is:

$$
6CO_2 + 6H_2O + \text{light} \rightarrow C_6H_{12}O_6 + 6O_2
$$

<SlideSecondColumnContent width="45%">

<KImage
  src="/uploads/chloroplast.png"
  alt="Chloroplast structure diagram"
  caption="Cross-section of a chloroplast showing thylakoids and stroma."
  label="chloroplast-structure"
  widthPresentation="auto"
  width={340}
/>

</SlideSecondColumnContent>

## Key Molecules Involved

- **Chlorophyll a** — primary pigment
- **Chlorophyll b** — accessory pigment
- **ATP** — energy carrier
- **NADPH** — electron carrier

<PresentOnly>

> Pause here and ask students to name where in the cell this process happens.

</PresentOnly>

## Light Absorption Spectra

The absorption spectra of the main pigments are shown in <RefFig label="absorption-spectrum" />.

<KImage
  src="/uploads/absorption-spectra.png"
  alt="Chlorophyll absorption spectra"
  label="absorption-spectrum"
  width={480}
  widthPresentation={620}
>
  Absorption spectra of chlorophyll a and b <Cite label="stryer2002" />.
</KImage>

## Worked Example

<Question type="example" title="ATP Yield per Glucose" initialState="expanded">

How many ATP molecules are produced per glucose molecule in the combined light and dark reactions?

<Answer>

The Calvin cycle requires 18 ATP per glucose. The light reactions generate approximately 2–3 ATP per NADPH molecule. Under ideal conditions, roughly **36–38 ATP** total are produced, though the precise value depends on membrane proton gradient efficiency.

</Answer>

</Question>

## Practice Exercise

<Question type="exercise" title="Limiting Factors">

A plant is kept in low-light conditions. Explain which stage of photosynthesis is most directly affected and why.

<Hint>

Consider which stage depends directly on absorbed photons.

</Hint>

<Answer>

The **light-dependent reactions** are most directly limited. Without sufficient photons, chlorophyll cannot be excited, so the production of ATP and NADPH (used to drive the Calvin cycle) is reduced. The Calvin cycle slows as a secondary consequence.

</Answer>

</Question>

## Video: Inside a Chloroplast

<YouTube id="EXAMPLE_VIDEO_ID" title="Inside a Chloroplast — Khan Academy" />

<SlideBreak />

### Key Takeaways

:::tip
Light reactions → ATP + NADPH → Calvin cycle → glucose.
:::

## Further Reading

<ExternalLink
  url="https://www.khanacademy.org/science/ap-biology/cellular-energetics"
  title="Khan Academy: Photosynthesis"
  description="Free interactive lessons on the full photosynthesis pathway."
/>

<Download
  url="/uploads/photosynthesis-worksheet.pdf"
  filename="photosynthesis-worksheet.pdf"
  label="Download Practice Worksheet"
/>

## Simulating the Reaction (Code)

```python
def photosynthesis(co2, h2o, light_energy):
    if light_energy > 0:
        glucose = (co2 * h2o) / 6
        oxygen = co2
        return {"glucose": glucose, "oxygen": oxygen}
    return None
```

<Todo>Add an interactive simulation widget here once the plugin is ready.</Todo>

<Comment>
Reviewed 2026-03-10 by Prof. Silva — content approved for publication.
</Comment>
```
