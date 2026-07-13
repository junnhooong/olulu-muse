# Manual Test Plan

Prerequisites: bot invited to a test guild with `applications.commands` + `Connect` + `Speak` voice permissions. `npm run deploy-commands` executed at least once.

## Setup
1. Join a voice channel in the test guild.
2. Confirm the bot is online (green dot).

## Golden path
- [ ] `/play https://www.youtube.com/watch?v=dQw4w9WgXcQ` — bot joins your voice channel; audio plays; embed appears.
- [ ] `/play never gonna give you up` — keyword search resolves and queues.
- [ ] `/nowplaying` — shows the current track.
- [ ] `/queue` — shows current + upcoming tracks.
- [ ] `/pause` then `/resume` — playback pauses and resumes.
- [ ] `/skip` — advances to next queued track.
- [ ] `/volume 50` — audio noticeably quieter.
- [ ] `/loop track` — current track repeats when it ends.
- [ ] `/loop queue` — after last track ends, playback wraps around.
- [ ] `/loop off` — playback stops when the queue is empty.
- [ ] `/shuffle` — queue order changes; current track is unchanged.
- [ ] `/stop` — queue clears; playback stops; bot stays connected.
- [ ] `/leave` — bot disconnects.

## Idle behavior
- [ ] With the bot playing, leave the voice channel (be the only human). Wait 30 seconds. Bot disconnects.
- [ ] Repeat, but rejoin within 30 seconds. Bot stays.

## Multi-guild
- [ ] Have the bot in two guilds; issue `/play` in each simultaneously; both play independently.

## Failure paths
- [ ] `/play <invalid-url>` — ephemeral error message; bot does not crash.
- [ ] `/play <region-locked-video>` — ephemeral SourceError message.
- [ ] `/skip` when nothing is playing — ephemeral "Nothing is playing."

## After test
- [ ] `docker compose logs bot` shows no `unhandledRejection` or `uncaughtException` entries.
