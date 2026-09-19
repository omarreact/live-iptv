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
- Local-first TV, Hot Now, and Movies & Series discovery

## Streaming architecture

```text
iptv-org catalog + IPTV Nexus shards
      ↓
multi-provider racing + health-aware source ranking
      ↓
safe same-origin proxy + automatic failover
      ↓
local/Hot Now discovery + iptv-org EPG mapping
      ↓
optional TMDB + TVmaze entertainment metadata
      ↓
hls.js / native HLS / mpegts.js
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
- **iptv-org API** for channels, streams, countries, categories, logos, and guide mappings
- **IPTV Nexus** for fast country/category shards and alternate discovery
- **iptv-org EPG/XMLTV** for Now/Next data where available
- **TMDB** optional entertainment metadata enrichment
- **TVmaze** no-key entertainment fallback
- **GDACS** verified disaster-alert source for Hot Now
- **Passive health/failover service** for source priority, latency observation, and automatic backup selection
- **Optional Bangladesh private-network bridge** for authorized ISP/private HLS sources without exposing upstream URLs or tokens

## Optional environment variables

```bash
NEXT_PUBLIC_SITE_URL=https://iptv.pincodeit.com
TMDB_API_READ_TOKEN=your_tmdb_read_token
# or legacy:
TMDB_API_KEY=your_tmdb_api_key
PINFLIX_BD_BRIDGE_URL=https://your-bridge.example.com
PINFLIX_BD_BRIDGE_SECRET=use-a-long-random-secret
PINFLIX_PRIVATE_PROXY_KEY=use-another-long-random-secret
```

TMDB is optional. Pinflix builds and runs without a TMDB credential.

The Bangladesh bridge is also optional. When its URL/secret are absent, private-channel entries are not exposed in discovery. See `bridge/README.md` for the private-network bridge setup.

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
