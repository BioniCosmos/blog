import type { MarkdownInstance } from 'astro'
import { basename } from 'node:path'

export type Article = {
  path: string
  title: string
  date: Date
  nav: Nav
} & FrontMatter &
  Pick<Md, 'Content'>

export const articles: Array<Article> = (
  await Promise.all(
    Object.values(import.meta.glob<Md>('../articles/*/*.md')).map((md) => md())
  )
).map((md, i, mds) => {
  return {
    path: getUrlPath(md.file),
    title: getTitle(md.getHeadings()),
    date: getDate(md.file),
    image: md.frontmatter.image,
    Content: md.Content,
    nav: {
      prev: i !== 0 ? NavInfo(mds[i - 1]!) : null,
      next: i !== mds.length - 1 ? NavInfo(mds[i + 1]!) : null,
    },
  }
})

interface FrontMatter {
  image: string
}

type Md = MarkdownInstance<FrontMatter>

interface Nav {
  prev: NavInfo | null
  next: NavInfo | null
}

interface NavInfo {
  path: string
  title: string
}

function NavInfo(article: Md): NavInfo {
  return {
    path: getUrlPath(article.file),
    title: getTitle(article.getHeadings()),
  }
}

function getUrlPath(filePath: Md['file']) {
  return basename(filePath, '.md').split('_')[1]!
}

function getTitle(headings: ReturnType<Md['getHeadings']>) {
  return headings.find(({ depth }) => depth === 1)?.text ?? ''
}

function getDate(filePath: Md['file']) {
  return new Date(basename(filePath, '.md').split('_')[0]!)
}
