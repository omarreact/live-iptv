# Pinflix — Live TV

Pinflix is a lightweight Next.js application for browsing and playing public IPTV streams from [iptv-org](https://github.com/iptv-org/iptv).

## Stack

- **Next.js 16 App Router** (React Server Components + Route Handlers)
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

The production application is deployed on Vercel at [iptv.pincodeit.com](https://iptv.pincodeit.com). The project uses Node.js 24. Set optional `NEXT_PUBLIC_SITE_URL` when deploying under another domain.

## Legal

Streams are third-party public broadcasts. Many are geo-restricted or offline. This project does not host media.
