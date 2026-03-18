# Kuara Content Authoring Guide

This guide explains how to write content for Kuara modules. Content is authored in **MDX** (Markdown + JSX) and stored in the Payload CMS admin panel under each module's `content` field. The platform renders the same source in two distinct modes: **Text Mode** (`texto`) and **Presentation Mode** (`apresentacao`).

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
   - [PresentOnly / TextOnly](#presentonly--textonly)
4. [Directive Shorthand Syntax](#4-directive-shorthand-syntax)
5. [Writing Math](#5-writing-math)
6. [Best Practices](#6-best-practices)
7. [Full MDX Template](#7-full-mdx-template)

---

## 1. Two Rendering Modes

Every module is rendered from a single MDX source. The reader can toggle between modes using the button in the top-right corner of the page (desktop only; mobile always uses Text Mode).

| | Text Mode | Presentation Mode |
|---|---|---|
| **Layout** | Scrollable document / article | Full-screen slide deck |
| **Navigation** | Scroll | Arrow keys, swipe, click |
| **`<PresentOnly>`** | Hidden | Visible |
| **`<TextOnly>`** | Visible | Hidden |
| **Two-column layout** | Stacked | Side-by-side |
| **Mobile** | Always active | Not available |

**Design principle:** write your content once. Use `<PresentOnly>` and `<TextOnly>` only when you genuinely need different wording or visual emphasis — not to duplicate content.

---

## 2. How Slides Are Created

You never have to manually wrap content in `<Slide>` tags. The platform automatically splits the content into slides using headings as dividers.

### Automatic slide splitting

Every `# H1`, `## H2`, or `### H3` heading starts a new slide. The heading text becomes the slide title shown in the header and progress bar.

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

> In Text Mode, the `<SlideCover>` renders as a styled hero section at the top of the page.

---

## 3. All Available Components

### Callout

Highlighted boxes to draw attention. Four types available:

```mdx
:::note
General information or clarification.
:::

:::tip
A helpful hint or shortcut.
:::

:::warning
Something the reader should be careful about.
:::

:::danger
Critical information — errors, data loss risks, etc.
:::
```

Callouts support full Markdown inside them, including **bold**, lists, and links.

---

### YouTube

Embed a YouTube video. You can use the full URL or just the video ID:

```mdx
<YouTube url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />

<!-- Or use the ID directly -->
<YouTube id="dQw4w9WgXcQ" title="Video title for accessibility" />

<!-- Start at a specific time (in seconds) -->
<YouTube id="dQw4w9WgXcQ" start={120} />
```

---

### PDF

Embed a PDF document inline. The viewer fills the available width:

```mdx
<PDF src="/uploads/research-paper.pdf" title="Research Paper 2024" />

<!-- Alternatively using url prop -->
<PDF url="https://example.com/doc.pdf" />
```

---

### KImage

The recommended way to insert images. `KImage` adapts automatically to each rendering mode.

```mdx
<KImage
  src="/uploads/diagram.png"
  alt="System architecture diagram"
  width={500}
  widthPresentation={700}
  align="center"
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `src` / `url` | string | Image path or URL |
| `alt` | string | Alt text (required for accessibility) |
| `width` | number | Width in px for Text Mode |
| `widthPresentation` | number \| `"auto"` | Width in px for Presentation Mode. Use `"auto"` to fill the slide height intelligently |
| `align` | `"left"` \| `"center"` \| `"right"` | Horizontal alignment (default: `"center"`) |

**When to use `widthPresentation="auto"`:** For diagrams or full-height images in presentation mode. The component measures the slide height and sizes the image to fit without overflowing.

```mdx
<!-- Fills slide height automatically in presentation mode -->
<KImage
  src="/uploads/tall-chart.png"
  alt="Annual data chart"
  width={400}
  widthPresentation="auto"
/>
```

---

### ExternalLink

A styled card that links to an external resource. Better than a raw hyperlink for important references:

```mdx
<ExternalLink
  url="https://www.example.com"
  title="Official Documentation"
  description="The complete reference guide for the library."
/>
```

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

---

### Code Blocks

Use standard fenced code blocks with a language tag. Syntax highlighting and a copy button are added automatically:

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

Supported languages include: `python`, `javascript`, `typescript`, `bash`, `json`, `yaml`, `sql`, `css`, `html`, `markdown`, and many more.

---

### SlideCover

Full-screen cover slide. Detailed props:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | Yes | Main title |
| `subtitle` | string | No | Subtitle line |
| `author` | string | No | Presenter name |
| `date` | string | No | Date string |
| `backgroundImage` | string | No | URL of background image |
| `backgroundMaskOpacity` | string | No | Darken overlay, e.g. `"40%"` |
| `backgroundMaskBlur` | string | No | Blur amount, e.g. `"4px"` |
| `logoImage` | string | No | URL of a logo shown in a corner |

---

### SlideSecondColumnContent

Creates a two-column layout within a slide. In Text Mode, the second column stacks below the first (or is hidden if `textModeVisible={false}`).

```mdx
## Two-column slide

This is the **left column** content. Write the main explanation here.

<SlideSecondColumnContent width="45%">

This is the **right column**. Great for an image, a code example, or key bullet points.

<KImage src="/uploads/example.png" alt="Example" widthPresentation="auto" />

</SlideSecondColumnContent>
```

The left column takes the remaining width (here, 55%). Use percentages for the `width` prop.

> `<SlideSecondColumnContent>` must be placed inside the same heading section (slide) as its paired left content. Do not cross heading boundaries.

---

### PresentOnly / TextOnly

Render content conditionally based on the active mode. Use sparingly — most content should work well in both modes.

```mdx
<PresentOnly>

**Speaker note:** emphasise the third point when presenting.

</PresentOnly>

<TextOnly>

> For deeper reading, see the references section at the end of this module.

</TextOnly>
```

**When to use:**
- `<PresentOnly>` — presentation aids like speaker cues, visual emphasis, or slide-specific diagrams
- `<TextOnly>` — expanded explanations, footnotes, or links that don't suit a slide format

The directive shorthand works too (see next section):

```markdown
:::present-only
Visible only in presentation mode.
:::

:::text-only
Visible only in text mode.
:::
```

---

## 4. Directive Shorthand Syntax

Instead of JSX tags, you can use the `:::` directive syntax for certain components. Both forms are equivalent; use whichever reads more naturally:

| Directive | Equivalent JSX |
|-----------|---------------|
| `:::note` | `<Callout type="note">` |
| `:::tip` | `<Callout type="tip">` |
| `:::warning` | `<Callout type="warning">` |
| `:::danger` | `<Callout type="danger">` |
| `:::present-only` or `:::po` | `<PresentOnly>` |
| `:::text-only` or `:::to` | `<TextOnly>` |
| `:::slide{layout="..."}` | `<Slide layout="...">` |

```markdown
:::tip
Short tip using directive syntax.
:::

:::po
This slide has a speaker note.
:::
```

---

## 5. Writing Math

Math is rendered via MathJax. Use standard LaTeX delimiters:

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

---

## 6. Best Practices

### Structure

- **Use H1 (`#`) for major topics** — each becomes a standalone slide and a sidebar entry for navigation.
- **Use H2 (`##`) for sub-topics** within a major section.
- **Use H3 (`###`) for detail slides** that support an H2.
- Avoid going deeper than H3 — it creates too many slides and fragmented text.
- Keep each slide focused on one idea. If a slide feels crowded, split it with `<SlideBreak />`.

### Content

- Write for both modes simultaneously. A slide with only a diagram and three bullet points reads poorly as a document section; add a short explanatory paragraph that the text reader needs.
- Use `<TextOnly>` to add that expanded explanation without cluttering the slides.
- Prefer `<KImage widthPresentation="auto">` for diagrams inside slides — it prevents overflow.
- Callouts break visual monotony and help the reader identify key information quickly.

### Images

- Always supply an `alt` text.
- Use `align="center"` for standalone diagrams, `align="left"` or `align="right"` when floating next to text.
- Set `width` for a reasonable text-mode reading size; `widthPresentation` for the slide.

### Two-column layouts

- Keep the total content of both columns proportional — a very long left column beside a tiny right column looks awkward.
- The right column is ideal for: a supporting image, a concise code snippet, a short list of bullet points, or a callout.

### YouTube and PDF

- Always add a `title` for accessibility screen readers.
- `<YouTube>` expands to fill its container; no need to specify dimensions.

---

## 7. Full MDX Template

A complete example combining all common patterns:

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

Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose.

:::note
This process is fundamental to almost all life on Earth.
:::

<TextOnly>
For a detailed biochemical pathway, refer to the supplementary reading in the resources section.
</TextOnly>

## The Light Reaction

The light reaction occurs in the thylakoid membrane and captures solar energy.

$$
6CO_2 + 6H_2O + \text{light} \rightarrow C_6H_{12}O_6 + 6O_2
$$

<SlideSecondColumnContent width="45%">

<KImage
  src="/uploads/chloroplast.png"
  alt="Chloroplast structure diagram"
  widthPresentation="auto"
/>

</SlideSecondColumnContent>

## Key Molecules Involved

- **Chlorophyll a** — primary pigment
- **Chlorophyll b** — accessory pigment
- **ATP** — energy carrier

<PresentOnly>

> Pause here and ask students to name where in the cell this process happens.

</PresentOnly>

## Video: Inside a Chloroplast

<YouTube id="EXAMPLE_ID" title="Inside a Chloroplast" />

<SlideBreak />

### Summary

:::tip
Remember: light reaction → ATP + NADPH; Calvin cycle → glucose.
:::

## Further Reading

<ExternalLink
  url="https://www.biology.com/photosynthesis"
  title="Khan Academy: Photosynthesis"
  description="Free interactive lessons on the full photosynthesis pathway."
/>

<Download
  url="/uploads/photosynthesis-worksheet.pdf"
  label="Download Practice Worksheet"
/>

## Code: Simulating Photosynthesis

```python
def photosynthesis(co2, h2o, light_energy):
    """Simple model of the overall photosynthesis reaction."""
    if light_energy > 0:
        glucose = (co2 * h2o) / 6
        oxygen = co2
        return {"glucose": glucose, "oxygen": oxygen}
    return None
```

```
