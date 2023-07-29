import tailwind from '@astrojs/tailwind'
import { defineConfig } from 'astro/config'
import { abstract } from './src/utils/abstract'

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  markdown: {
    remarkPlugins: [abstract],
  },
})
