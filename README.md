# Aether — Live TV

A live television web app. It reads the public [iptv-org](https://github.com/iptv-org/iptv) catalog and plays channels in the browser.

## Features

- Live guide of ~12,000 public channels
- Browse by category and country
- Search by station, genre, or country
- HLS (and MPEG-TS) player with a same-origin stream proxy
- Save channels and keep a recently-watched list on this device

Streams come from public broadcasters. Many are geo-restricted, offline, or blocked by the origin — the player will say so and let you retry or skip ahead.

## Stack

React 19, TanStack Start, Tailwind v4, hls.js, mpegts.js.

## Develop

```bash
npm install
npm run dev
```

The app listens on port 8080.

```bash
npm run build
npm run typecheck
```

Catalog source: `https://iptv-org.github.io/iptv/index.m3u`
