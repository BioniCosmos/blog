import { join } from 'node:path'
import { getArticles } from './article'

export const langMap = { zh: '中文', en: 'English' } as const
export const defaultLang = 'zh'

type Lang = keyof typeof langMap
type Label = (typeof langMap)[Lang]

export interface Language {
  lang: Lang
  label: Label
  isDefault: boolean
}
export const languages = Object.entries(langMap).map(
  ([lang, label]) =>
    ({
      lang,
      label,
      isDefault: lang === defaultLang,
    } as Language)
)

export function getRootPath(language: Language) {
  return language.isDefault ? '/' : `/${language.lang}`
}

export function getArticlePath(id: string, language: Language) {
  return join(getRootPath(language), id)
}

export function getPagePath(pageIndex: string | undefined, language: Language) {
  return join(getRootPath(language), pageIndex ?? '')
}

export async function articleHasTranslation(id: string, language: Language) {
  if (!translations.has(id)) {
    const articles = await getArticles()
    const articlesLangMap = articles.map(({ language, articles }) => [
      language.lang,
      articles.find((article) => article.id === id) !== undefined,
    ])
    translations.set(id, Object.fromEntries(articlesLangMap))
  }
  return translations.get(id)![language.lang]
}

const translations = new Map<string, Record<Lang, boolean>>()
