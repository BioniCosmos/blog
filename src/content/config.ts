import { defineCollection, z } from 'astro:content'

const articleCollection = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      image: image().optional(),
    }),
})

export const collections = {
  articles: articleCollection,
}

export type Image = z.infer<
  Exclude<typeof articleCollection.schema, Function | undefined>
>['image']
