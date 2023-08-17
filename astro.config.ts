import tailwind from '@astrojs/tailwind'
import { defineConfig } from 'astro/config'
import { abstract } from './src/utils/abstract'
import { extractRefInImageCaption, imageCaption } from './src/utils/footnote'

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  markdown: {
    remarkPlugins: [abstract, extractRefInImageCaption],
    rehypePlugins: [imageCaption],
  },
  experimental: {
    assets: true,
  },
})
