import type { MarkdownInstance } from 'astro'
import { getCollection } from 'astro:content'
import type { Image } from '../content/config'
import {
  DateTime,
  Nav,
  NavInfo,
  getTitle,
  parseFilePath,
  rendered,
} from '../utils/article'

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
