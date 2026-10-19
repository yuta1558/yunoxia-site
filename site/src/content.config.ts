import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    // Meta description only (falls back to summary)
    description: z.string().optional(),
    status: z.enum(['進行中', '完了', '構想']),
    updated: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    // Card picture: a photo, screenshot or drawing under /assets/works/ (new file name on change)
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
  }),
});

// English versions of Works. File names (ids) match the Japanese entries one to one.
const worksEn = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/en/works' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    // Meta description only (falls back to summary)
    description: z.string().optional(),
    status: z.enum(['In progress', 'Done', 'Planned']),
    updated: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
  }),
});

const log = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/log' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { works, worksEn, log };
