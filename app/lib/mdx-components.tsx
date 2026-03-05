/**
 * lib/mdx-components.ts
 *
 * Single unified component map for all MDX rendering.
 * Fixes the Telaclass duplication problem where component overrides
 * were defined in 3 separate places.
 */
import Slide from '@/components/mdx/Slide'
import SlideDeck from '@/components/mdx/SlideDeck'
import { PresentOnly, TextOnly } from '@/components/mdx/Only'
import Callout from '@/components/mdx/Callout'
import YouTube from '@/components/mdx/YouTube'
import PDF from '@/components/mdx/PDF'
import KImage from '@/components/mdx/KImage'
import ExternalLink from '@/components/mdx/ExternalLink'
import Download from '@/components/mdx/Download'
import CodeBlock from '@/components/mdx/CodeBlock'
import type { ComponentType } from 'react'

/**
 * Returns the full MDX component map.
 * This is the single source of truth for all custom components
 * available in MDX content.
 */
export function getMdxComponents(): Record<string, ComponentType<any>> {
    return {
        // Presentation components
        Slide,
        SlideDeck,
        PresentOnly,
        TextOnly,

        // Content components
        Callout,
        YouTube,
        PDF,
        KImage,
        ExternalLink,
        Download,

        // Code block override
        pre: (props: any) => {
            const child = props.children
            if (child?.type === 'code') {
                return (
                    <CodeBlock
                        code={child.props.children}
                        className={child.props.className}
                    />
                )
            }
            return <pre {...props} />
        },
    }
}
