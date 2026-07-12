# olulu-muse

Discord music bot that plays YouTube audio.

## Setup

1. `cp .env.example .env` and fill in `DISCORD_TOKEN` and `CLIENT_ID` from the Discord Developer Portal.
2. `npm install`
3. `npm run deploy-commands` (one-shot, after editing commands)
4. `npm start`

## Requirements

- Node.js 20+
- `ffmpeg` on PATH
- `yt-dlp` on PATH

## Docker

`docker compose up -d` (see `Dockerfile` / `docker-compose.yml`).
