import type { MarkdownHeading } from 'astro'
import type { getCollection } from 'astro:content'
import { basename } from 'node:path'

export interface Nav {
  prev: NavInfo | null
  next: NavInfo | null
}

interface NavInfo {
  path: string
  title: string
}

export interface DateTime {
  date: string
  time: string
}

export async function rendered(
  entries: Awaited<ReturnType<typeof getCollection>>
) {
  const renders = await Promise.all(entries.map((entry) => entry.render()))
  return entries.map((entry, i) => ({ ...entry, render: renders[i]! }))
}

export function NavInfo({
  id,
  render: { headings },
}: Awaited<ReturnType<typeof rendered>>[number]): NavInfo {
  return {
    path: parseFilePath(id).path,
    title: getTitle(headings),
  }
}

export function getTitle(headings: Array<MarkdownHeading>) {
  return headings.find(({ depth }) => depth === 1)?.text ?? ''
}

export function parseFilePath(filePath: string): {
  path: string
  dateTime: DateTime
} {
  const [dateTime = '', path = ''] = basename(filePath, '.md').split('_')
  const [date = '', time = ''] = dateTime.split('T')
  return { path, dateTime: { date, time } }
}
