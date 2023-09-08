import tailwind from '@astrojs/tailwind'
import { defineConfig } from 'astro/config'
import rehypeMathjax from 'rehype-mathjax'
import remarkMath from 'remark-math'
import { abstract } from './src/utils/abstract'
import {
  extractRefInImageCaption,
  imageCaption,
  removeParagraph,
} from './src/utils/footnote'

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  markdown: {
    remarkPlugins: [abstract, extractRefInImageCaption, remarkMath],
    rehypePlugins: [imageCaption, removeParagraph, rehypeMathjax],
    syntaxHighlight: 'prism',
  },
  experimental: {
    assets: true,
  },
})
