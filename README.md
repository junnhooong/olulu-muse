# olulu-muse

Discord music bot that plays YouTube audio in voice channels. Supports URL or keyword search, queue management, playback controls, loop/shuffle, volume, and multi-guild isolation.

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io/)
- `ffmpeg` on `PATH`
- `yt-dlp` on `PATH`

## Setup

1. Copy the env template and fill in credentials from the [Discord Developer Portal](https://discord.com/developers/applications):

   ```bash
   cp .env.example .env
   # then edit .env
   ```

   - `DISCORD_TOKEN` — bot token (Bot page → Reset Token)
   - `CLIENT_ID` — application ID (General Information page)

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Register slash commands with Discord (one-shot; re-run whenever a command changes):

   ```bash
   pnpm run deploy-commands
   ```

4. Build and start the bot:

   ```bash
   pnpm build && pnpm start
   ```

   Or for development with hot TypeScript execution:

   ```bash
   pnpm dev
   ```

## Inviting the bot to a server

Generate an OAuth2 invite URL in the Developer Portal (OAuth2 → URL Generator):

- Scopes: `bot`, `applications.commands`
- Bot permissions: `Connect`, `Speak`, `Send Messages`, `Embed Links`

Open the resulting URL and pick a server.

## Commands

All commands are slash commands. Join a voice channel first, then use `/play`.

| Command | Description |
|---|---|
| `/play <query>` | Play a YouTube URL or search by keywords. Adds to the queue if something is already playing. |
| `/pause` | Pause the current track. |
| `/resume` | Resume playback. |
| `/skip` | Skip to the next track. |
| `/stop` | Stop playback and clear the queue (stays connected). |
| `/leave` | Disconnect from the voice channel. |
| `/queue` | Show the current queue (current track + next 10). |
| `/nowplaying` | Show the currently playing track. |
| `/shuffle` | Shuffle the upcoming queue (current track is unchanged). |
| `/loop <off\|track\|queue>` | Set loop mode. `track` repeats the current song; `queue` cycles the queue. |
| `/volume <0-200>` | Set volume. `100` is default; `200` is 2× loud. |
| `/ping` | Health check. |

### Example session

```
you: /play never gonna give you up
bot: ▶ Now playing: Rick Astley - Never Gonna Give You Up (Official Music Video)

you: /play https://youtu.be/dQw4w9WgXcQ
bot: Queued: Rick Astley - Never Gonna Give You Up (Official Music Video)

you: /loop track
bot: Loop mode: **track**

you: /skip
bot: Skipped.
```

## Behavior

- **Multi-guild:** each guild has an independent player. Playing in one server doesn't affect another.
- **Idle timeout:** if the bot is alone in a voice channel for 30 seconds, it disconnects automatically.
- **In-memory only:** queues and settings reset when the bot restarts.
- **Ephemeral errors:** invalid queries and command errors reply only to you (not the whole channel).

## Docker

```bash
docker compose up -d --build
```

The image is multi-stage: build stage runs `pnpm build`; runtime stage installs `ffmpeg` + `yt-dlp` and runs the compiled output.

Logs:

```bash
docker compose logs -f bot
```

## Development

```bash
pnpm dev         # run from TS via tsx (no build step)
pnpm test        # run node:test suite via tsx
pnpm typecheck   # tsc --noEmit
pnpm build       # compile to dist/
```

See `docs/TEST_PLAN.md` for the manual QA checklist to run in a test guild before releasing.
