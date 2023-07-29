import { toHtml } from 'hast-util-to-html'
import type { Root } from 'mdast'
import { toHast } from 'mdast-util-to-hast'
import type { Plugin } from 'unified'
import type { Frontmatter } from '../pages/article'

export const abstract: Plugin<[], Root> = () => {
  return (tree, file) => {
    const moreTagIndex = tree.children.findIndex(
      (content) => content.type === 'html' && content.value === '<!--more-->'
    )
    const abstractTree: Root = {
      type: 'root',
      children: tree.children.slice(0, moreTagIndex),
    }
    ;(file.data.astro as Astro).frontmatter.abstract = toHtml(
      toHast(abstractTree as Parameters<typeof toHast>[0]) as Parameters<
        typeof toHtml
      >[0]
    )
  }
}

interface Astro {
  frontmatter: Frontmatter
}
