/**
 * lib/mdx-pipeline.ts
 * 
 * Shared MDX processing utilities for the Kuara Telaclass platform.
 * Provides server-side MDX compilation via next-mdx-remote/rsc and
 * heading extraction for sidebar navigation.
 */
import { compileMDX } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'
import rehypeMathjax from 'rehype-mathjax'
import rehypeSlug from 'rehype-slug'
import remarkDirectiveToMdx from '../mdx-plugins/remark-directive-to-mdx'
import remarkWrapSlides from '../mdx-plugins/remark-wrap-slides'

// For heading extraction
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import GithubSlugger from 'github-slugger'

export interface Heading {
    id: string
    text: string
}

/**
 * The shared remark/rehype plugin chain used for all MDX rendering.
 */
const remarkPlugins = [
    remarkGfm,
    remarkMath,
    remarkDirective,
    remarkDirectiveToMdx,
    remarkWrapSlides,
]

const rehypePlugins: any = [
    [rehypeMathjax, { tex: { tags: 'ams' } }],
    rehypeSlug,
]

/**
 * Compile an MDX string into React elements using next-mdx-remote/rsc.
 * Returns the rendered content and optional frontmatter.
 */
export async function compileMdx(
    source: string,
    components: Record<string, React.ComponentType<any>> = {}
) {
    const { content, frontmatter } = await compileMDX({
        source,
        components,
        options: {
            mdxOptions: {
                remarkPlugins,
                rehypePlugins,
            },
            parseFrontmatter: true,
        },
    })

    return { content, frontmatter }
}

/**
 * Build a base unified processor with the shared remark plugins.
 * Used for AST analysis (heading extraction) without rendering.
 */
function buildRemarkBase() {
    return unified()
        .use(remarkParse)
        .use(remarkMdx)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkDirective)
        .use(remarkDirectiveToMdx)
}

/**
 * Extract level-2 headings (##) from MDX source with GitHub-style slug IDs.
 * Used for sidebar scroll-spy navigation.
 */
export function extractHeadings(source: string): Heading[] {
    const headings: Heading[] = []
    const slugger = new GithubSlugger()

    const collectHeadings = () => (tree: any) => {
        visit(tree, 'heading', (node: any) => {
            if (node.depth === 2) {
                const text = toString(node).trim()
                if (!text) return
                const id = slugger.slug(text)
                headings.push({ id, text })
            }
        })
    }

    const processor = buildRemarkBase().use(collectHeadings)
    const ast = processor.parse(source)
    processor.runSync(ast)

    return headings
}
