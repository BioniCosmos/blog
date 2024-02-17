import type { MarkdownInstance, PaginateFunction } from 'astro'
import { getCollection, type CollectionEntry } from 'astro:content'
import { basename, join } from 'node:path'
import type { Image } from '../content/config'

export async function getArticles() {
  const allArticles = await getAllArticles()
  return allArticles.flat()
}

export async function getLocalArticles(lang: Lang): Promise<Article[]> {
  if (!articles.has(lang)) {
    const localCollection = await getCollection('articles', ({ id }) =>
      id.startsWith(`${lang}/`)
    )
    const renderedArticles = await Promise.all(
      localCollection.map(render(lang))
    )
    const localArticles = renderedArticles
      .toSorted(compareDateTime)
      .map(addNav)
      .toReversed()
    articles.set(lang, localArticles)
  }
  return articles.get(lang)!
}

export function getAllArticles() {
  return Promise.all(langs.map((lang) => getLocalArticles(lang)))
}

export function addLangPrefix(page: ReturnType<PaginateFunction>, i: number) {
  return langs[i] !== defaultLang
    ? page.map(({ params, props }) => ({
        params: { page: join(`/${langs[i]}`, params.page ?? '') },
        props,
      }))
    : page
}

export interface Article {
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

type NoNav = Omit<Article, 'nav'>

const langs = ['zh', 'en'] as const
const defaultLang: Lang = 'zh'
type Lang = (typeof langs)[number]

function render(lang: Lang) {
  return async (article: CollectionEntry<'articles'>): Promise<NoNav> => {
    const {
      Content,
      headings,
      remarkPluginFrontmatter: { abstract },
    } = await article.render()

    const title = headings.find(({ depth }) => depth === 1)?.text ?? ''
    const image = article.data.image

    function parseFilePath(filePath: string): {
      path: string
      dateTime: DateTime
    } {
      const [dateTime = '', path = ''] = basename(filePath, '.md').split('_')
      return {
        path: join(lang !== defaultLang ? `/${lang}` : '', `/${path}`),
        dateTime: new DateTime(dateTime),
      }
    }

    return { ...parseFilePath(article.id), title, Content, abstract, image }
  }
}

function compareDateTime(a: NoNav, b: NoNav) {
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

function addNav(article: NoNav, i: number, articles: NoNav[]): Article {
  const nav = {
    prev: i > 0 ? articles[i - 1]! : null,
    next: i < articles.length - 1 ? articles[i + 1]! : null,
  } as Nav
  return { ...article, nav }
}

const articles = new Map<Lang, Article[]>()
