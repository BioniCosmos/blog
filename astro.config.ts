import tailwind from '@astrojs/tailwind'
import { defineConfig } from 'astro/config'
import rehypeMathjax from 'rehype-mathjax'
import remarkMath from 'remark-math'
import remarkMermaid from 'remark-mermaidjs'
import { abstract } from './src/utils/abstract'
import {
  extractRefInImageCaption,
  imageCaption,
  removeParagraph,
} from './src/utils/footnote'
import { openExternalLinksInNewTab } from './src/utils/link'

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  markdown: {
    remarkPlugins: [
      abstract,
      extractRefInImageCaption,
      remarkMath,
      remarkMermaid,
    ],
    rehypePlugins: [
      imageCaption,
      removeParagraph,
      rehypeMathjax,
      openExternalLinksInNewTab,
    ],
    shikiConfig: {
      theme: 'dark-plus',
    },
  },
})
