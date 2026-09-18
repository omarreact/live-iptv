# Pinflix — Watch the world live

Pinflix is a fast, live-TV-first Next.js application for discovering and watching public and authorized television streams from around the world.

## Product direction

The interface follows one path: **find → play → watch**.

- No marketing hero or dashboard chrome
- Country-first and category-based discovery
- Prominent search
- Favorites + recent channels
- Quiet automatic source failover
- Now/Next EPG when a mapped guide is available
- Mobile-first controls with TV/remote-friendly focus states

## Streaming architecture

```text
iptv-org catalog
      ↓
health-aware source ranking
      ↓
safe same-origin proxy + automatic failover
      ↓
iptv-org EPG mapping / XMLTV Now-Next
      ↓
optional TMDB title enrichment
      ↓
hls.js / native HLS / mpegts.js
```

The health layer combines transport safety, stream restrictions, quality, and short-lived runtime failure hints. Failed sources are temporarily penalized on warm server instances so later playback can prefer a healthier backup.

The proxy remains catalog-restricted and blocks private/internal hosts.

## Stack

- **Next.js 16 App Router**
- **React 19 + TypeScript**
- **Tailwind CSS v4**
- **hls.js** for HLS playback
- **mpegts.js** for MPEG-TS fallback
- **Zustand** for device-local favorites and recent channels
- **iptv-org API** for channels, streams, countries, categories, logos, and guide mappings
- **iptv-org EPG/XMLTV** for Now/Next data where available
- **TMDB** optional metadata enrichment

## Optional environment variables

```bash
NEXT_PUBLIC_SITE_URL=https://iptv.pincodeit.com
TMDB_API_READ_TOKEN=your_tmdb_read_token
# or legacy:
TMDB_API_KEY=your_tmdb_api_key
```

TMDB is optional. Pinflix builds and runs without a TMDB credential.

## Develop

```bash
npm install
npm run dev
```

Validation:

```bash
npm run typecheck
npm run lint
npm run build
```

## Deployment

Production: https://iptv.pincodeit.com

The Vercel project uses Node.js 24.

## Legal

Pinflix does not host third-party media. Public stream URLs can be geo-restricted, offline, or removed by their broadcasters. Metadata enrichment does not grant streaming rights; only public or properly authorized streams should be distributed through the application.
