import {
  langs,
  queryArticlesById,
  type Lang,
  type Translations,
} from './article'

const translations = new Map<string, Translations>()

export function hasTranslation(id: string, lang: Lang) {
  if (!translations.has(id)) {
    const articles = queryArticlesById(id)
    const translated = articles.map((article) => article.lang)
    const all = langs.map((lang) => [lang, translated.includes(lang)])
    translations.set(id, Object.fromEntries(all))
  }
  return translations.get(id)![lang]
}
