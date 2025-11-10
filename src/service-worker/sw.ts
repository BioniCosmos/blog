/// <reference lib="webworker" />

export {}

declare const self: ServiceWorkerGlobalScope
declare const version: number
declare const preCachedPaths: string[]

const cacheName = `blog-cache-${version}`

async function handleInstall() {
  const cache = await caches.open(cacheName)
  await cache.addAll(preCachedPaths)
}

async function handleActivate() {
  const keys = await caches.keys()
  await Promise.all(
    keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))
  )
}

async function handleFetch(request: Request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      await cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    if (request.mode === 'navigate') {
      const response = await caches.match('/offline')
      return response!
    }
    return new Response(null, { status: 503 })
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(handleInstall())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(handleActivate())
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request))
})
