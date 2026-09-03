# Aether — Live TV

Lightweight Next.js app for browsing and playing public IPTV streams from [iptv-org](https://github.com/iptv-org/iptv).

## Stack

- **Next.js App Router** (RSC + Route Handlers)
- **Tailwind CSS v4**
- **hls.js** / **mpegts.js** client player with multi-source fallback
- **Zustand** for device-local favorites / recent only
- Catalog via `https://iptv-org.github.io/api` with `revalidate: 3600`

## Features

- Country → category and category → country filters
- Dynamic sort: Best · Quality · A–Z · Sources
- Same-origin stream proxy (`/api/stream`) for CORS / referrer / UA
- No auth, no database — public guide only

## Develop

```bash
npm install
npm run dev
```

```bash
npm run build && npm start
npm run typecheck
```

## Deploy

Vercel (or any Node 20+ host). Set optional `NEXT_PUBLIC_SITE_URL` for metadata.

## Legal

Streams are third-party public broadcasts. Many are geo-restricted or offline. This project does not host media.
