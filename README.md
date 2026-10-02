# Live IPTV

A clean live-TV-only Next.js application built around the supplied M3U playlist.

## What changed

The previous Pinflix/MovieBox/NID/entertainment code has been removed from the application tree. The new app now has one job: load, normalize, browse, and play live television.

### Pipeline

```text
Supplied M3U Gist
  -> server-side refresh (5 minute cache)
  -> strict M3U parsing
  -> channel-name normalization
  -> duplicate channel merge
  -> ranked primary + fallback sources
  -> catalog-scoped same-origin proxy
  -> hls.js / native HLS / mpegts.js
```

### Features

- M3U catalog refreshes automatically from the latest Gist endpoint
- pinned revision fallback if the latest endpoint is unavailable
- duplicate channel names become backup sources instead of duplicate cards
- HTTPS/domain/HLS sources are ranked ahead of weaker raw-IP/HTTP sources
- automatic player failover
- Bangla/category browsing and channel search
- responsive mobile/desktop/TV-friendly interface
- stream URLs stay server-side; the public catalog API exposes metadata only
- proxy blocks localhost, private networks, metadata hosts, and unsupported protocols
- HLS child resources are limited to the selected source host/subdomains

## Environment variables

Both are optional because the supplied playlist is the default:

```bash
IPTV_PLAYLIST_URL=
IPTV_PLAYLIST_FALLBACK_URL=
```

## Development

```bash
npm ci
npm run check
npm run dev
```

## Deployment

This repository is intended for the Vercel project **live-iptv**.

## Content policy

The application is a player/indexer and does not host television media. Only streams you are authorized to access or distribute should be used in production. Upstream availability and rights can change independently of this application.
