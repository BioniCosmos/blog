import type { MarkdownInstance } from 'astro'
import { basename } from 'node:path'

export type Article = {
  path: string
  title: string
  dateTime: DateTime
  nav: Nav
} & Frontmatter &
  Pick<Md, 'Content'>

export const articles: Array<Article> = (
  await Promise.all(
    Object.values(import.meta.glob<Md>('../articles/*/*.md')).map((md) => md())
  )
).map((md, i, mds) => ({
  ...splitFilePath(md.file),
  ...md.frontmatter,
  title: getTitle(md.getHeadings()),
  Content: md.Content,
  nav: {
    prev: i !== 0 ? NavInfo(mds[i - 1]!) : null,
    next: i !== mds.length - 1 ? NavInfo(mds[i + 1]!) : null,
  },
}))

export interface Frontmatter {
  abstract: string
  image: string
}

type Md = MarkdownInstance<Frontmatter>

interface Nav {
  prev: NavInfo | null
  next: NavInfo | null
}

interface NavInfo {
  path: string
  title: string
}

interface DateTime {
  date: string
  time: string
}

function NavInfo(article: Md): NavInfo {
  return {
    path: splitFilePath(article.file).path,
    title: getTitle(article.getHeadings()),
  }
}

function getTitle(headings: ReturnType<Md['getHeadings']>) {
  return headings.find(({ depth }) => depth === 1)?.text ?? ''
}

function splitFilePath(filePath: Md['file']): {
  path: string
  dateTime: DateTime
} {
  const [dateTime = '', path = ''] = basename(filePath, '.md').split('_')
  const [date = '', time = ''] = dateTime.split('T')
  return { path, dateTime: { date, time } }
}
