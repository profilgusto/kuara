// mdx-plugins/remark-wrap-slides.ts
// Wraps top-level content between ## headings into <Slide> components.
// Also supports explicit :::slide directives and ---sldbrk / ---sldlayoutN markers
// for backward compatibility with existing Telaclass MDX content.
import type { Plugin } from 'unified'
import { toString } from 'mdast-util-to-string'

type Node = any
type Parent = { type: string; children: Node[] }

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') || 'slide'
}

const remarkWrapSlides: Plugin = () => {
    return (tree: Node) => {
        if (!tree || tree.type !== 'root') return
        const root = tree as Parent
        const kids = root.children || []
        if (!kids.length) return

        // Quick scan: does it have any heading that would trigger slide splitting?
        const hasBreakHeading = kids.some(
            (n: Node) => n.type === 'heading' && (n.depth === 2 || n.depth === 3 || n.depth === 4)
        )
        if (!hasBreakHeading) return

        // Build segments
        const segments: Node[][] = []
        let current: Node[] = []
        let currentLayout = '1'
        const segmentLayouts: string[] = []

        const push = () => {
            if (current.length) {
                segments.push(current)
                segmentLayouts.push(currentLayout)
                current = []
            }
        }

        function isSlideBreak(n: Node): boolean {
            if (n.type === 'paragraph' && Array.isArray(n.children) && n.children.length === 1) {
                const c = n.children[0]
                if (c.type === 'text' && c.value && c.value.trim() === '---sldbrk') return true
            }
            return false
        }

        function isLayoutCommand(n: Node): { isLayout: boolean; layout?: string } {
            if (n.type === 'paragraph' && Array.isArray(n.children) && n.children.length === 1) {
                const c = n.children[0]
                if (c.type === 'text' && c.value) {
                    const trimmed = c.value.trim()
                    const match = trimmed.match(/^---sldlayout(\d+)$/)
                    if (match) {
                        return { isLayout: true, layout: match[1] }
                    }
                }
            }
            return { isLayout: false }
        }

        for (const n of kids) {
            const layoutCheck = isLayoutCommand(n)

            if (layoutCheck.isLayout) {
                currentLayout = layoutCheck.layout || '1'
                continue
            }

            if (
                (n.type === 'heading' && (n.depth === 2 || n.depth === 3 || n.depth === 4)) ||
                isSlideBreak(n)
            ) {
                push()
                if (isSlideBreak(n)) continue
                current.push(n)
            } else {
                current.push(n)
            }
        }
        push()

        // Generate mdxJsxFlowElement nodes
        const out: Node[] = []
        const used = new Set<string>()

        segments.forEach((seg, idx) => {
            const heading =
                seg.find((n: Node) => n.type === 'heading' && n.depth === 2) ||
                seg.find((n: Node) => n.type === 'heading' && n.depth === 1) ||
                seg.find((n: Node) => n.type === 'heading' && n.depth === 3) ||
                seg.find((n: Node) => n.type === 'heading' && n.depth === 4)

            const text = heading
                ? toString(heading).trim()
                : idx === 0
                    ? 'introducao'
                    : `slide-${idx + 1}`

            let base = slugify(text) || `slide-${idx + 1}`
            let id = base
            let counter = 2
            while (used.has(id)) {
                id = `${base}-${counter++}`
            }
            used.add(id)

            const layout = segmentLayouts[idx] || '1'

            out.push({
                type: 'mdxJsxFlowElement',
                name: 'Slide',
                attributes: [
                    { type: 'mdxJsxAttribute', name: 'data-id', value: id },
                    { type: 'mdxJsxAttribute', name: 'data-layout', value: layout },
                ],
                children: seg,
            })
        })

        root.children = out
    }
}

export default remarkWrapSlides
