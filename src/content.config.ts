import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/articles' }),
  schema: ({ image }) => z.object({ image: image().optional() }),
})

export const collections = { articles }

export type Image = z.infer<
  Exclude<typeof articles.schema, Function | undefined>
>['image']
