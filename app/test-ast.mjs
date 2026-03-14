import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'

const mdx = `
# Título H1 A
Mussum Ipsum, cacilds vidis litro abertis. Sapien in monti palavris qui num significa nadis i pareci latim.

## Título H2 A
Mussum Ipsum, cacilds vidis litro abertis. Sapien in monti palavris.

<KImage
  url="foo.png"
/>
`

const processor = unified().use(remarkParse).use(remarkMdx)
const ast = processor.parse(mdx)

ast.children.forEach(c => console.log(c.type, c.depth || '', c.name || ''))
