import { toHtml } from 'hast-util-to-html'
import type { Root } from 'mdast'
import { toHast } from 'mdast-util-to-hast'
import type { Plugin } from 'unified'
import { u } from 'unist-builder'
import { find } from 'unist-util-find'
import { findAllBefore } from 'unist-util-find-all-before'

export const abstract: Plugin<[], Root> = () => (tree, file) => {
  const more = find(tree, { value: '<!--more-->' })
  if (more === undefined) {
    return
  }
  const [_title, ...abstract] = findAllBefore(tree, more)
  const abstractTree = u('root', abstract)
  ;(file.data.astro as any).frontmatter.abstract = toHtml(
    toHast(abstractTree as any)!
  )
}
