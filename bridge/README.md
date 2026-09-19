# Pinflix IPTV Bridge

This tiny Node.js service must run **inside the network that can reach the private IPTV portal/media servers**. Pinflix on Vercel cannot route directly to RFC1918 addresses such as the ones observed in the HAR capture.

## What it does

1. Pinflix requests an authorized bridge URL for a configured stream ID.
2. The bridge requests the provider's `player.php?stream=<id>` page inside the private network.
3. It extracts the fresh signed `primarySource` HLS URL.
4. It fetches and rewrites every HLS child playlist / init segment / media segment behind encrypted bridge tokens.
5. Pinflix's existing `/api/stream` proxy wraps the bridge URLs again, so the browser never receives the provider IP, provider token, or bridge secret.

The current HAR-confirmed T Sports mapping uses provider stream ID `105`.

## Run

```bash
cd bridge
BRIDGE_SECRET="use-a-long-random-secret-at-least-24-chars" \
BRIDGE_TOKEN_KEY="another-long-random-secret-at-least-24-chars" \
IPTV_PLAYER_BASE="http://172.16.14.1" \
ALLOWED_STREAM_IDS="105" \
PORT=8787 \
npm start
```

The machine running this process must be able to open the private IPTV portal and stream endpoints.

## Expose it safely

Expose the bridge through an HTTPS reverse proxy or authenticated tunnel. Do **not** expose the private IPTV hosts themselves.

Then configure Vercel:

```text
PINFLIX_BD_BRIDGE_URL=https://your-bridge.example.com
PINFLIX_BD_BRIDGE_SECRET=<same BRIDGE_SECRET>
PINFLIX_PRIVATE_PROXY_KEY=<separate long random key, optional but recommended>
```

The bridge provides `GET /health` for a basic reachability check.


## Network media libraries

The same bridge can expose media libraries that are explicitly configured by the operator. Pinflix never accepts arbitrary upstream URLs from the browser; every target must remain inside one of the configured source roots.

Set `MEDIA_SOURCES_JSON` to a JSON array:

```bash
MEDIA_SOURCES_JSON='[
  {
    "id": "home-media",
    "name": "Home Media",
    "description": "Movies available on my local network",
    "baseUrl": "http://192.168.1.50/movies/"
  }
]'
PINFLIX_APP_ORIGIN="https://iptv.pincodeit.com"
```

Optional playback compatibility settings:

```text
BRIDGE_MEDIA_TOKEN_KEY=<long random key; falls back to BRIDGE_TOKEN_KEY>
FFMPEG_PATH=ffmpeg
FFMPEG_VIDEO_CODEC=libx264
FFMPEG_PRESET=veryfast
```

For files that the browser cannot decode natively (for example some MKV/HEVC combinations), the Pinflix player can request an FFmpeg compatibility stream. FFmpeg must be installed on the bridge machine. Hardware encoders such as `h264_qsv` or `h264_nvenc` can be selected with `FFMPEG_VIDEO_CODEC` when supported by that machine.

Only add sources you are authorized to access and stream.
