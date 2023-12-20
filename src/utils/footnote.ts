import type {
  Element,
  ElementContent,
  Root as HastRoot,
  RootContent,
} from 'hast'
import { selectAll } from 'hast-util-select'
import { h } from 'hastscript'
import type { Image, Root as MdastRoot } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

export const extractRefInImageCaption: Plugin<[], MdastRoot> = () => (tree) => {
  visit(
    tree,
    (node) => node.type === 'image' && (node as Image).title !== '',
    (node, i, parent) => {
      const title = (node as Image).title!
      const match = /\[\^(\d+)\]/g.exec(title)
      if (match === null || match[1] === undefined) {
        return
      }
      parent?.children.splice(i! + 1, 0, {
        type: 'footnoteReference',
        identifier: match[1],
        label: match[1],
      })
    }
  )
}

export const imageCaption: Plugin<[], HastRoot> = () => (tree) => {
  visit(
    tree,
    (node) =>
      node.type === 'element' &&
      (node as Element).tagName === 'img' &&
      ((node as Element).properties?.title?.toString() ?? '') !== '',
    (node, i, parent) => {
      parent = parent!
      const title = (node as Element).properties?.title?.toString()!
      const caption = parseRawCaption(title, parent.children)
      const figureNode = h('figure', [node, h('figcaption', caption)])
      parent.children[i!] = figureNode
    }
  )
}

interface Token {
  type: 'text' | 'footnote'
  position: { start: number; end: number }
}

function parseRawCaption(
  caption: string,
  refs: Array<RootContent>
): Array<ElementContent> {
  const matches = Array.from(caption.matchAll(/\[\^(\d+)\]/g), (match) => ({
    start: match.index!,
    end: match.index! + match[0].length,
  }))

  const tokens = Array.of<Token>()
  for (let i = 0; i < matches.length; ) {
    const lastToken = tokens.at(-1) ?? {
      type: 'text',
      position: { start: 0, end: 0 },
    }

    const match = matches[i]!
    if (match.start === lastToken.position.end) {
      tokens.push({ type: 'footnote', position: match })
      i++
    } else {
      tokens.push({
        type: 'text',
        position: {
          start: lastToken.position.end,
          end: match.start,
        },
      })
    }
  }

  let refLength = matches.length
  return refLength !== 0
    ? tokens.map(({ type, position: { start, end } }) => {
        if (type === 'footnote') {
          const ref = refs.splice(-refLength, 1)[0] as Element
          refLength--
          return ref
        }
        return { type: 'text', value: caption.slice(start, end) }
      })
    : Array.of({ type: 'text', value: caption })
}

export const removeParagraph: Plugin<[], HastRoot> = () => (tree) => {
  const footnotes = selectAll('section > ol > li', tree)
  footnotes.forEach(
    (footnote) =>
      (footnote.children = (footnote.children[1] as Element).children)
  )
}
