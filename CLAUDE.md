# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `packageManager` in `package.json`).

```bash
pnpm dev                            # run from TS via tsx (no build step)
pnpm build                          # tsc → dist/
pnpm start                          # node dist/src/index.js (requires prior build)
pnpm test                           # tsx --test 'test/**/*.test.ts'
pnpm typecheck                      # tsc --noEmit
pnpm run deploy-commands            # register slash commands with Discord (one-shot; re-run when a command's data changes)
tsx --test test/player/idle.test.ts # run a single test file
```

Runtime dependencies **outside npm**: `ffmpeg` and `yt-dlp` must be on `PATH`. Missing either causes runtime failures inside `src/sources/youtube.ts` (which spawns `yt-dlp` as a child process).

Required env in `.env`: `DISCORD_TOKEN`, `CLIENT_ID`. Both are validated at boot in `src/index.ts` and `scripts/deploy-commands.ts` — the process exits if either is missing.

`tsc` uses `rootDir: "."` and includes both `src/` and `scripts/`, so compiled output lands at `dist/src/...` and `dist/scripts/...` (note the extra `src` segment in `main`). Tests are excluded from the build; they run directly via `tsx --test`.

## Architecture

The bot is a thin Discord.js v14 client that dispatches slash-command interactions to per-guild players. The design deliberately keeps Discord's voice + gateway APIs at the edges so the core is unit-testable without a live connection.

### Dependency-injection seam

Every module in `src/player/`, `src/sources/`, and `src/bot/handlers.ts` operates on `*Like` interfaces from `src/types.ts` (`AudioPlayerLike`, `VoiceConnectionLike`, `RegistryLike`, `CommandInteraction`, etc.). The real Discord/`@discordjs/voice` objects are wired in only at the composition root (`src/index.ts`), which builds a `GuildPlayerDeps` around `joinVoiceChannel`, `createAudioPlayer`, `createAudioResource`, and `ytStream`.

**Implication:** when adding functionality that touches voice, audio, or the Discord client, add methods to the `*Like` interfaces first and inject through `deps` — do **not** import from `@discordjs/voice` or `discord.js` in `player/`, `sources/`, or command modules. Tests rely on this.

### Per-guild isolation

`Registry` (`src/player/registry.ts`) owns a `Map<guildId, GuildPlayer>`. `getOrCreate` is the only way commands acquire a player. `destroy` tears down the voice connection and removes the entry — used by both `/leave` and the idle watcher. State is in-memory only; a restart wipes queues.

### GuildPlayer lifecycle

`GuildPlayer` (`src/player/guildPlayer.ts`) manages one guild's queue, current track, loop mode, and volume. Key invariants:

- `connect()` is idempotent (guarded by `this.audioPlayer`).
- Track advancement is driven by the audio player's `stateChange` → `idle` event, which calls `_onTrackEnd` → `_playNext`. This is the only place loop-mode logic (`track` unshifts, `queue` pushes) is applied.
- Errored tracks skip the re-queue on loop and post a `track-error` embed via `deps.postEmbed`.
- `enqueue()` starts playback only when `!current && audioPlayer` — meaning `/play` must call `connect()` before the first `enqueue()` (see `src/commands/play.ts`).

### Idle watcher

`createIdleWatcher` (`src/player/idle.ts`) listens to `VoiceStateUpdate` and destroys the guild's player after `timeoutMs` (30s) if no non-bot member remains in the bot's voice channel. It resolves the bot's channel from `player.voiceConnection.joinConfig.channelId` by default. Uses injected `timers` so tests can drive time deterministically.

### YouTube source

`src/sources/youtube.ts` shells out to `yt-dlp` twice per track:
1. `resolve()` — `--dump-single-json` to get metadata; searches use `ytsearch1:` prefix when the query isn't a YouTube URL.
2. `stream()` — `-o - -f bestaudio` to pipe raw audio to `createAudioResource` with `StreamType.Arbitrary`.

`spawn` is injectable for testing.

### Command modules

Each file in `src/commands/*.ts` exports `{ data, execute }` and is registered in `src/commands/index.ts`. `execute(interaction, ctx)` receives a `CommandContext` with `registry`, `resolveTrack`, and `connect` — no direct access to the Discord client. `createHandler` (`src/bot/handlers.ts`) wraps errors and replies ephemerally (`flags: 1 << 6`).

Adding a new command: create `src/commands/foo.ts`, add it to the `commands` Map in `src/commands/index.ts`, then run `pnpm run deploy-commands` to publish the updated command set to Discord.

## Manual QA

`docs/TEST_PLAN.md` is the manual checklist to run in a test guild before releasing. Automated tests cover the player/source/handler logic but cannot exercise the real voice pipeline.
