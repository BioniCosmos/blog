import type { MarkdownHeading, MarkdownInstance } from 'astro'
import { getCollection } from 'astro:content'
import { basename } from 'node:path'
import type { Image } from '../content/config'

export interface Article {
  path: string
  title: string
  dateTime: DateTime
  Content: MarkdownInstance<{}>['Content']
  abstract: string
  image: Image
  nav: Nav
}

let _articles: Array<Article> | null = null

export async function articles() {
  if (_articles === null) {
    _articles = (await rendered(await getCollection('articles'))).map(
      (
        {
          id,
          data: { image },
          render: {
            Content,
            headings,
            remarkPluginFrontmatter: { abstract },
          },
        },
        i,
        articleEntries
      ) => ({
        ...parseFilePath(id),
        title: getTitle(headings),
        Content,
        abstract,
        image,
        nav: {
          prev: i !== 0 ? NavInfo(articleEntries[i - 1]!) : null,
          next:
            i !== articleEntries.length - 1
              ? NavInfo(articleEntries[i + 1]!)
              : null,
        },
      })
    )
  }
  return _articles
}

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

async function rendered(entries: Awaited<ReturnType<typeof getCollection>>) {
  const renders = await Promise.all(entries.map((entry) => entry.render()))
  return entries.map((entry, i) => ({ ...entry, render: renders[i]! }))
}

function NavInfo({
  id,
  render: { headings },
}: Awaited<ReturnType<typeof rendered>>[number]): NavInfo {
  return {
    path: parseFilePath(id).path,
    title: getTitle(headings),
  }
}

function getTitle(headings: Array<MarkdownHeading>) {
  return headings.find(({ depth }) => depth === 1)?.text ?? ''
}

function parseFilePath(filePath: string): {
  path: string
  dateTime: DateTime
} {
  const [dateTime = '', path = ''] = basename(filePath, '.md').split('_')
  const [date = '', time = ''] = dateTime.split('T')
  return { path, dateTime: { date, time } }
}
