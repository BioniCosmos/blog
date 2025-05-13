import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import serviceWorker from 'astrojs-service-worker'
import rehypeMathjax from 'rehype-mathjax'
import remarkMath from 'remark-math'
import type { GenerateSWOptions } from 'workbox-build'
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
  integrations: [
    serviceWorker({
      workbox: {
        manifestTransforms: [
          (entries) => ({
            manifest: entries.map(({ url, ...entry }) => ({
              ...entry,
              url: url.replace(/\/index\.html$/, ''),
            })),
          }),
        ],
      } as GenerateSWOptions,
    }),
  ],
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
