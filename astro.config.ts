import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import rehypeMathjax from 'rehype-mathjax'
import remarkMath from 'remark-math'
import { abstract } from './src/utils/abstract'
import {
  extractRefInImageCaption,
  imageCaption,
  removeParagraph,
} from './src/utils/footnote'
import { openExternalLinksInNewTab } from './src/utils/link'

// https://astro.build/config
export default defineConfig({
  site: 'https://moecm.com',
  markdown: {
    remarkPlugins: [abstract, extractRefInImageCaption, remarkMath],
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
  vite: {
    plugins: [tailwindcss()],
  },
})
