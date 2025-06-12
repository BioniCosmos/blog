import type { Config } from 'tailwindcss'

export default {
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            a: { fontWeight: `unset` },
            code: { fontWeight: `unset`, fontVariantLigatures: `none` },
            blockquote: { quotes: `none` },
            iframe: { marginInline: `auto` },
          },
        },
      },
    },
  },
} satisfies Config
