import typography from '@tailwindcss/typography'
import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {},
  },
  plugins: [
    typography,
    plugin(({ addBase }) => {
      addBase({
        '[data-footnote-ref]': {
          '&::before': { content: '"["' },
          '&::after': { content: '"]"' },
        },
        img: {
          marginLeft: 'auto',
          marginRight: 'auto',
        },
        blockquote: {
          fontStyle: 'normal !important',
          quotes: '"" "" "" "" !important',
        },
      })
    }),
  ],
} satisfies Config
