import type { MarkdownInstance, PaginateFunction } from 'astro'
import { getCollection, type CollectionEntry } from 'astro:content'
import { basename, join } from 'node:path'
import type { Image } from '../content/config'

export async function getArticles() {
  if (articles === undefined) {
    const untranslatedArticles = await Promise.all(
      langs.map(langWithLocalArticles)
    )
    articles = Object.fromEntries(untranslatedArticles) as any
    const translatedArticles = untranslatedArticles.map(
      ([lang, localArticles]) => [
        lang,
        localArticles.map((localArticle) =>
          addTranslations(localArticle, lang)
        ),
      ]
    )
    articles = Object.fromEntries(translatedArticles)
  }
  return articles!
}

export function addLang([lang, page]: [Lang, ReturnType<PaginateFunction>]) {
  return page.map(({ params, props }) => ({
    params: {
      page: join(
        lang !== defaultLang ? `/${lang}` : '',
        `/${params.page ?? ''}`
      ),
    },
    props: { ...props, lang },
  }))
}

export function queryArticlesById(id: string) {
  return Object.values(articles!)
    .flat()
    .filter((article) => article.id === id)
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
  translations: Translations
  lang: Lang
}

export interface Nav {
  prev: Article | null
  next: Article | null
}

export type Translations = Record<Lang, boolean>

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

type BaseArticle = Omit<Article, 'nav' | 'translations'>
type UntranslatedArticle = Omit<Article, 'translations'>

export const languages = { zh: '中文', en: 'English' } as const
export const langs = Object.keys(languages) as Lang[]
export const defaultLang: Lang = 'zh'
export type Lang = keyof typeof languages

function render(lang: Lang) {
  return async (article: CollectionEntry<'articles'>): Promise<BaseArticle> => {
    const {
      Content,
      headings,
      remarkPluginFrontmatter: { abstract },
    } = await article.render()

    const title = headings.find(({ depth }) => depth === 1)?.text ?? ''
    const image = article.data.image

    function parseFilePath(filePath: string): {
      id: string
      path: string
      dateTime: DateTime
    } {
      const [dateTime = '', path = ''] = basename(filePath, '.md').split('_')
      return {
        id: path,
        path: join(lang !== defaultLang ? `/${lang}` : '', `/${path}`),
        dateTime: new DateTime(dateTime),
      }
    }

    return {
      ...parseFilePath(article.id),
      title,
      Content,
      abstract,
      image,
      lang,
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
): UntranslatedArticle {
  const nav = {
    prev: i > 0 ? articles[i - 1]! : null,
    next: i < articles.length - 1 ? articles[i + 1]! : null,
  } as Nav
  return { ...article, nav }
}

function addTranslations(
  article: UntranslatedArticle,
  currentLang: Lang
): Article {
  return {
    ...article,
    translations: Object.fromEntries(
      langs
        .filter((lang) => lang !== currentLang)
        .map((lang) => [
          lang,
          articles![lang].find(
            (localArticle) => localArticle.id === article.id
          ) !== undefined,
        ])
    ) as Translations,
  }
}

async function langWithLocalArticles(lang: Lang) {
  return [lang, await getLocalArticles(lang)] as [Lang, UntranslatedArticle[]]
}

async function getLocalArticles(lang: Lang): Promise<UntranslatedArticle[]> {
  const localCollection = await getCollection('articles', ({ id }) =>
    id.startsWith(`${lang}/`)
  )
  const renderedArticles = await Promise.all(localCollection.map(render(lang)))
  return renderedArticles.toSorted(compareDateTime).map(addNav).toReversed()
}

let articles: Record<Lang, Article[]> | undefined
