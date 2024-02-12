import type { Root } from 'hast'
import { selectAll } from 'hast-util-select'
import type { Plugin } from 'unified'

export const openExternalLinksInNewTab: Plugin<[], Root> = () => (tree) => {
  selectAll('a', tree)
    .filter((element) => {
      const href = element.properties.href as string
      return (
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('//')
      )
    })
    .forEach((element) => (element.properties.target = '_blank'))
}
