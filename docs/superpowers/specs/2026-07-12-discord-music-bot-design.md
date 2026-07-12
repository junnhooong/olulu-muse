# Discord Music Bot — Design

**Date:** 2026-07-12
**Status:** Approved (pending user spec review)

## Goal

A Discord bot that plays audio from YouTube (URL or keyword search) in voice channels, with queue management, playback controls, loop/shuffle, and volume. Supports multiple Discord servers (guilds) concurrently, each with an independent queue.

## Non-goals

- Persisting queue state across restarts (in-memory only)
- Playlist expansion (single video or top-search-result only)
- Role/permission gating (any user in the voice channel can control playback)
- Sources other than YouTube
- Web dashboard, analytics, or database

## Stack

- **Runtime:** Node.js (LTS)
- **Discord library:** `discord.js` v14
- **Voice:** `@discordjs/voice` + `ffmpeg` + `libsodium-wrappers` (or `sodium-native`)
- **YouTube:** `yt-dlp` invoked as a subprocess (installed in the container)
- **Command style:** Slash commands only (`/play`, `/skip`, ...)
- **Deployment:** Docker container (Node + ffmpeg + yt-dlp bundled)

## Feature list (v1)

| Command | Args | Behavior |
|---|---|---|
| `/play` | `query: string` (URL or keywords) | Resolves via yt-dlp, joins caller's voice channel if needed, enqueues; starts playing if idle |
| `/skip` | — | Skip current track |
| `/pause` | — | Pause playback |
| `/resume` | — | Resume playback |
| `/stop` | — | Clear queue, stop playback (stay connected) |
| `/queue` | — | Show current + upcoming tracks (paginated embed, 10 per page) |
| `/nowplaying` | — | Show current track with progress |
| `/loop` | `mode: off\|track\|queue` | Set loop mode |
| `/shuffle` | — | Shuffle upcoming queue (current track unchanged) |
| `/volume` | `level: 0-200` | Set volume via inline volume transformer |
| `/leave` | — | Disconnect, destroy player |

**Idle behavior:** When the bot is alone in its voice channel for 30 seconds, it disconnects and destroys its `GuildPlayer`.

## Architecture

Layered by concern. Each unit has one purpose and communicates through explicit interfaces.

```
src/
├── index.js              # entrypoint
├── bot/
│   ├── client.js         # discord.js Client + intents
│   ├── register.js       # slash command definitions
│   └── handlers.js       # interactionCreate dispatcher
├── commands/
│   ├── index.js          # Map<name, {data, execute}>
│   ├── play.js
│   ├── skip.js
│   ├── pause.js
│   ├── resume.js
│   ├── stop.js
│   ├── queue.js
│   ├── nowplaying.js
│   ├── loop.js
│   ├── shuffle.js
│   ├── volume.js
│   └── leave.js
├── player/
│   ├── guildPlayer.js    # GuildPlayer class (one per guild)
│   ├── registry.js       # Map<guildId, GuildPlayer>
│   └── idle.js           # leave-when-alone timer
└── sources/
    └── youtube.js        # yt-dlp adapter (resolve + stream)
scripts/
└── deploy-commands.js    # one-shot: PUT global slash commands
Dockerfile
docker-compose.yml
.env.example              # DISCORD_TOKEN, CLIENT_ID
```

### Boundaries

- `bot/` knows Discord, not audio.
- `player/` knows audio state and voice connections, not yt-dlp or chat.
- `sources/youtube.js` is the **only** file that shells out to `yt-dlp`. If YouTube behavior changes, one file is patched.
- `commands/*` are thin — parse interaction, call `player` or `sources`, reply. No business logic.

## Components

### `GuildPlayer` (`src/player/guildPlayer.js`)

One instance per guild, held by `registry`.

**State:**
```js
{
  guildId: string,
  textChannelId: string,      // where to post playback events
  voiceConnection: VoiceConnection,
  audioPlayer: AudioPlayer,
  queue: Track[],             // upcoming, index 0 = next
  current: Track | null,
  loopMode: 'off' | 'track' | 'queue',
  volume: number,             // 0..200, default 100
  currentResource: AudioResource | null,  // for volume changes mid-track
  idleTimer: NodeJS.Timeout | null,
}
```

**Methods:**
- `connect(voiceChannel)` — `joinVoiceChannel`, subscribe audio player, wire state listeners
- `enqueue(tracks: Track[])` — append; if idle, call `_playNext()`
- `skip()` — stop current resource; state listener triggers `_playNext()`
- `pause()`, `resume()`, `stop()` (clear queue), `setLoop(mode)`, `shuffle()` (Fisher–Yates on `queue`)
- `setVolume(n)` — clamp 0..200; if `currentResource.volume`, set immediately
- `destroy()` — clear idle timer, destroy voice connection, remove from registry
- `_playNext()` (private) — shift from queue, stream from `sources/youtube`, create resource with inline volume, play

### `Track` type

```js
{
  title: string,
  url: string,
  durationSec: number,
  thumbnailUrl: string | null,
  requestedBy: { id: string, tag: string },
}
```

### `sources/youtube.js`

Two functions. **Only** file that spawns yt-dlp.

- `async resolve(query: string): Promise<Track[]>`
  - URL detection: `/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//`
  - URL → `yt-dlp --no-playlist --dump-single-json <url>`
  - Keywords → `yt-dlp "ytsearch1:<query>" --dump-single-json`
  - Parses JSON stdout → `Track[]` (length 1 in v1)
  - Non-zero exit → throw `SourceError` with parsed stderr

- `stream(track: Track): Readable`
  - Spawns `yt-dlp -o - -f bestaudio --no-playlist <url>`
  - Returns child's `stdout` (a `Readable`)
  - Caller (`GuildPlayer`) is responsible for wiring to `createAudioResource(stream, { inputType: Arbitrary, inlineVolume: true })` (which internally pipes through ffmpeg for opus encoding)

### `player/registry.js`

- `getOrCreate(guildId, textChannelId): GuildPlayer`
- `get(guildId): GuildPlayer | undefined`
- `destroy(guildId): void`

### `player/idle.js`

Subscribes to `voiceStateUpdate`. For each event:
1. If bot has a `GuildPlayer` in that guild, and bot is in a voice channel:
2. Count non-bot members in bot's channel.
3. If 0 → start 30s timer to `registry.destroy(guildId)`.
4. If ≥1 → clear any existing timer.

### `bot/handlers.js`

Single `interactionCreate` listener:
```js
if (!interaction.isChatInputCommand()) return
const cmd = commands.get(interaction.commandName)
try { await cmd.execute(interaction, { registry }) }
catch (err) { logError; ephemeral reply "Something went wrong." }
```

## Data flow

### `/play <query>` (golden path)
1. `handlers.js` dispatches to `commands/play.js`.
2. Validate: user is in a voice channel → else ephemeral error.
3. `interaction.deferReply()` (yt-dlp resolve is slow).
4. `sources/youtube.resolve(query)` → `Track[]`.
5. `registry.getOrCreate(guildId, textChannelId)` → player.
6. If `player.voiceConnection` absent → `player.connect(voiceChannel)`.
7. `player.enqueue(tracks)`.
8. Reply with embed: "Queued: **Title** (m:ss)" — or "Now playing" if the player was idle.

### Playback loop (inside `GuildPlayer._playNext`)
1. If `queue.length === 0` and no loop → `current = null`, done.
2. `current = queue.shift()` (or per loop rules — see below).
3. `stream = sources.youtube.stream(current)`.
4. `resource = createAudioResource(stream, { inputType: Arbitrary, inlineVolume: true })`.
5. `resource.volume.setVolume(volume / 100)`.
6. `currentResource = resource`; `audioPlayer.play(resource)`.
7. Post "▶ Now playing" embed to `textChannelId`.
8. On `AudioPlayerStatus.Idle`:
   - `loopMode === 'track'` → put `current` back at front → `_playNext()`.
   - `loopMode === 'queue'` → push `current` to end → `_playNext()`.
   - `loopMode === 'off'` → `_playNext()` (next in queue, or go idle).

### Idle / leave-when-alone
See `player/idle.js` in Components. Timer = 30s.

### Multi-guild isolation
`registry` is `Map<guildId, GuildPlayer>`. Every command starts by looking up its guild's player. No cross-guild state. Two guilds playing at once is supported by Node's event loop + separate voice connections.

## Error handling

**Command layer:** Validate user input (voice channel presence, argument ranges). Ephemeral reply for user errors. Never throw upward.

**Source layer:**
- `resolve()` failure (unavailable, region-locked, private, network) → throw `SourceError('...')`. `play.js` catches → ephemeral error.
- `stream()` errors → emitted on the returned `Readable`. `GuildPlayer` listens; treats as track failure.

**Player layer:**
- Any failure inside `_playNext()` → post public embed "⚠ Skipping **Title** — couldn't play" → call `_playNext()` for the next track. Never stall the queue on one bad track.
- Voice connection `Disconnected` → attempt one reconnect via `entersState(Signalling|Connecting, 5s)`. If that fails, `destroy()`.
- Log with `[guildId=..., trackUrl=...]` context.

**Global safety net (`src/index.js`):**
`process.on('unhandledRejection')` + `uncaughtException` → log, don't crash. Docker restart policy handles genuine crashes.

**Reply visibility:**
- User errors → ephemeral
- Playback events (queued / now playing / skipped) → public in `textChannelId`
- Track failures → public

## Configuration

`.env`:
```
DISCORD_TOKEN=...
CLIENT_ID=...
```

No per-guild config file in v1.

## Deployment

**Dockerfile** (multi-stage recommended but not required):
- Base: `node:20-slim`
- Install `ffmpeg`, `python3`, and `yt-dlp` (via `pip` or a pinned binary release)
- Copy source, `npm ci --omit=dev`, `CMD ["node", "src/index.js"]`

**docker-compose.yml:**
- One service, restart `unless-stopped`, env from `.env`

**Slash command registration:**
`scripts/deploy-commands.js` — one-shot script the developer runs after adding/changing commands. Uses Discord's REST API to PUT global commands.

## Testing

**Unit tests** (Jest or `node:test`):

- `player/guildPlayer.js` (mock `@discordjs/voice` + `sources/youtube`):
  - `enqueue` starts playback if idle; appends otherwise
  - `skip` advances, honors loop mode
  - `setLoop('track')`: same track re-enqueued at front on end
  - `setLoop('queue')`: track pushed to end
  - `shuffle`: `queue` reordered, `current` untouched
  - `setVolume` clamps 0..200
  - `destroy` removes from registry and cleans up
- `sources/youtube.js` (mock `child_process.spawn`):
  - URL input → yt-dlp invoked with URL
  - Keyword input → `ytsearch1:` prefix
  - Non-zero exit → `SourceError` thrown
- `player/idle.js` (fake timers):
  - Timer starts when alone; clears when human joins

**Manual smoke test** — `docs/TEST_PLAN.md`:
1. `/play <url>` — bot joins, plays
2. `/play <keywords>` — resolves search, queues
3. `/queue`, `/skip`, `/pause`, `/resume` — respond correctly
4. `/loop track` — track repeats
5. Leave voice channel — bot leaves after 30s
6. `/play` in guild A while playing in guild B — both play simultaneously

**No E2E against real Discord/YouTube** — flaky, low value.

## Open questions / future work

- Playlist support (would extend `sources/youtube.resolve` to return N tracks)
- Vote-skip, DJ role, per-guild config
- SoundCloud / Spotify (Spotify would require a resolver → YouTube search)
- Persistence for queue survival across restarts
