import typography from '@tailwindcss/typography'
import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Han',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
        mono: [
          '"Cascadia Code"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      typography: {
        DEFAULT: {
          css: {
            blockquote: {
              fontStyle: 'normal',
              quotes: 'none',
            },
          },
        },
      },
    },
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
        'mjx-container[jax="SVG"] > svg': { display: 'inline' },
        code: { fontVariantLigatures: 'none' },
      })
    }),
  ],
} satisfies Config
