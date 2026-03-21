/**
 * SkipBreak
 *
 * An invisible marker component. When placed immediately before an H1/H2/H3
 * heading in MDX, it tells the remark-wrap-slides plugin to NOT start a new
 * slide at that heading — the heading stays in the current slide.
 *
 * Usage:
 *   ## Previous slide title
 *   Some content...
 *
 *   <SkipBreak />
 *   ### This heading stays in the same slide
 */
export default function SkipBreak() {
    return null
}
