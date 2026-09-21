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
- Curated Live TV guide: 42 Bangladesh channels + 100 foreign channels
- Movies & Series discovery remains separate from the Live TV catalog

## Streaming architecture

```text
iptv-org metadata + streams + EPG mappings
      ↓
Pinflix 142-channel curation policy
      ↓
health-aware source ranking + safe same-origin proxy
      ↓
automatic source failover
      ↓
hls.js / native HLS / mpegts.js

Movies, TV Series, and Animation use a separate server-side entertainment provider/resolver with same-origin playback and subtitle gateways. The optional Bangladesh private-network bridge remains isolated from the public Live TV catalog.
```

The health layer combines transport safety, stream restrictions, quality, and passive runtime observations. Each proxied upstream attempt records success/failure plus response latency. Pinflix keeps a bounded, short-lived in-memory health profile per source (success ratio, consecutive failures, and EWMA latency), then re-ranks primary/backup sources on later opens. This is intentionally viewer-anonymous and Vercel-safe: it stores no user identifiers and does not run expensive background probes.

A viewer-safe diagnostic endpoint is available at `/api/health?channel=<id>`. It returns only aggregate availability, source count, preferred quality, and health score — never upstream URLs or request headers.

The proxy remains catalog-restricted and blocks private/internal hosts. The health/failover design is inspired by the operational ideas used by dedicated IPTV managers such as Dispatcharr — stream monitoring, source priority, and automatic failover — without adding Dispatcharr as a runtime dependency.

## Stack

- **Next.js 16 App Router**
- **React 19 + TypeScript**
- **Tailwind CSS v4**
- **hls.js** for HLS playback
- **mpegts.js** for MPEG-TS fallback
- **Zustand** for device-local favorites and recent channels
- **iptv-org API** as the upstream metadata/stream/EPG source, filtered by Pinflix's 142-channel public curation policy
- **iptv-org EPG/XMLTV** for Now/Next data where available
- **TMDB** optional entertainment metadata enrichment
- **TVmaze** no-key entertainment fallback
- **Passive health/failover service** for source priority, latency observation, and automatic backup selection
- **Optional Bangladesh private-network bridge** for authorized ISP/private HLS sources without exposing upstream URLs or tokens

## Optional environment variables

```bash
NEXT_PUBLIC_SITE_URL=https://pinflix.pincodeit.com
TMDB_API_READ_TOKEN=your_tmdb_read_token
# or legacy:
TMDB_API_KEY=your_tmdb_api_key
PINFLIX_BD_BRIDGE_URL=https://your-bridge.example.com
PINFLIX_BD_BRIDGE_SECRET=use-a-long-random-secret
PINFLIX_PRIVATE_PROXY_KEY=use-another-long-random-secret
```

TMDB is optional and is only used to enrich live-TV EPG titles. The Movies & Web Series page does not use TMDB or TVmaze.

The Bangladesh bridge is optional and reserved for authorized private-network playback. Private bridge entries are not injected into the public 142-channel discovery catalog. See `bridge/README.md` for setup.

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

Production: https://pinflix.pincodeit.com

The Vercel project uses Node.js 24.

## Legal

Pinflix does not host third-party media. Public stream URLs can be geo-restricted, offline, or removed by their broadcasters. Metadata enrichment does not grant streaming rights; only public or properly authorized streams should be distributed through the application.
