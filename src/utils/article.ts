import type { MarkdownInstance, PaginateFunction } from 'astro'
import {
  render as collectionRender,
  getCollection,
  type CollectionEntry,
} from 'astro:content'
import { basename } from 'node:path'
import type { Image } from '../content.config'
import { getArticlePath, getPagePath, languages, type Language } from './i18n'

export async function getArticles() {
  if (articles === undefined) {
    articles = await Promise.all(
      languages.map(async (language) => ({
        language,
        articles: await getLocalArticles(language),
      }))
    )
  }
  return articles
}

export function addLanguage({
  language,
  pages,
}: {
  language: Language
  pages: ReturnType<PaginateFunction>
}) {
  return pages.map(({ params, props }) => ({
    params: {
      page: getPagePath(params.page, language),
    },
    props: { ...props, language },
  }))
}

export interface Article {
  id: string
  path: string
  title: string
  dateTime: DateTime
  Content: MarkdownInstance<{}>['Content']
  abstract: string
  image: Image
  nav: Nav
}

export interface Nav {
  prev: Article | null
  next: Article | null
}

class DateTime {
  date: string
  time: string

  constructor(dateTime: string) {
    ;[this.date = '', this.time = ''] = dateTime.split('T')
  }

  toString() {
    return `${this.date} ${this.time}`
  }
}

type BaseArticle = Omit<Article, 'nav'>

export function render(language: Language) {
  return async (article: CollectionEntry<'articles'>): Promise<BaseArticle> => {
    const {
      Content,
      headings,
      remarkPluginFrontmatter: { abstract },
    } = await collectionRender(article)

    const title = headings.find(({ depth }) => depth === 1)?.text ?? ''
    const image = article.data.image

    function parseFilePath(filePath: string) {
      const [dateTime = '', path = ''] = basename(filePath, '.md').split('_')
      return {
        id: path,
        path: getArticlePath(path, language),
        dateTime: new DateTime(dateTime),
      }
    }

    return {
      ...parseFilePath(article.filePath!),
      title,
      Content,
      abstract,
      image,
    }
  }
}

function compareDateTime(a: BaseArticle, b: BaseArticle) {
  const s1 = a.dateTime.toString()
  const s2 = b.dateTime.toString()
  if (s1 < s2) {
    return -1
  }
  if (s1 > s2) {
    return 1
  }
  return 0
}

function addNav(
  article: BaseArticle,
  i: number,
  articles: BaseArticle[]
): Article {
  const nav = {
    prev: i > 0 ? articles[i - 1]! : null,
    next: i < articles.length - 1 ? articles[i + 1]! : null,
  } as Nav
  return { ...article, nav }
}

async function getLocalArticles(language: Language): Promise<Article[]> {
  const localCollection = await getCollection('articles', ({ id }) =>
    id.startsWith(`${language.lang}/`)
  )
  const renderedArticles = await Promise.all(
    localCollection.map(render(language))
  )
  return renderedArticles.toSorted(compareDateTime).map(addNav).toReversed()
}

interface LanguageArticles {
  language: Language
  articles: Article[]
}

let articles: LanguageArticles[] | undefined
