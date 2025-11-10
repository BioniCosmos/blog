import type { AstroIntegration } from 'astro'
import { transform } from 'esbuild'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export default {
  name: 'service-worker',
  hooks: {
    'astro:build:done': async ({ logger, pages, dir }) => {
      logger.info('Building the Service Worker…')
      const content = await readFile('./src/service-worker/sw.ts')
      const tsConfig = await readFile('./tsconfig.json')
      const assets = await readdir(join(dir.pathname, '_astro'))
      const preCachedPaths = pages
        .map((page) => page.pathname)
        .map(trimSuffix('/'))
        .map((pathname) => `/${pathname}`)
        .concat(
          assets
            .filter((asset) => asset.endsWith('.css') || asset.endsWith('.js'))
            .map((asset) => `/_astro/${asset}`)
        )
      const result = await transform(content, {
        tsconfigRaw: tsConfig.toString(),
        loader: 'ts',
        define: {
          version: `${Date.now()}`,
          preCachedPaths: JSON.stringify(preCachedPaths),
        },
        minify: true,
      })
      await writeFile(join(dir.pathname, 'sw.js'), result.code)
    },
  },
} as AstroIntegration

function trimSuffix(suffix: string) {
  return (s: string) => {
    if (s.endsWith(suffix)) {
      return s.slice(0, s.length - suffix.length)
    }
    return s
  }
}
