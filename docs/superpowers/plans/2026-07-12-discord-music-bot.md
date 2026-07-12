# Discord Music Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Discord music bot that plays YouTube audio (URL or keyword) in voice channels, with queue management, playback controls, loop/shuffle, volume, and multi-guild isolation.

**Architecture:** Layered Node.js/discord.js codebase. `bot/` handles Discord I/O, `commands/` are thin handlers, `player/` owns per-guild playback state via a `GuildPlayer` class in a `Map<guildId, GuildPlayer>` registry, and `sources/youtube.js` is the sole adapter that shells out to `yt-dlp`. In-memory state only. Deployed via Docker with `node`, `ffmpeg`, and `yt-dlp`.

**Tech Stack:** Node.js 20 LTS, `discord.js` v14, `@discordjs/voice`, `sodium-native`, `yt-dlp` (subprocess), `ffmpeg` (subprocess, invoked by `@discordjs/voice`), `node:test` for tests.

## Global Constraints

- Node.js 20 LTS
- ESM modules (`"type": "module"` in `package.json`)
- Slash commands only (no prefix commands)
- In-memory state only — no database, no disk persistence
- `sources/youtube.js` is the ONLY file that spawns `yt-dlp`
- Test framework: `node:test` (built-in, no extra dependency)
- Idle timeout when alone in voice channel: 30 seconds
- Volume range: 0..200 (100 = 100%)
- Loop modes: `'off' | 'track' | 'queue'`

---

### Task 1: Project scaffold + config

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `src/index.js`

**Interfaces:**
- Consumes: (none)
- Produces: `npm start` runs `node src/index.js`; environment variables `DISCORD_TOKEN` and `CLIENT_ID` load via `dotenv`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "olulu-muse",
  "version": "0.1.0",
  "description": "Discord music bot that plays YouTube audio",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "deploy-commands": "node scripts/deploy-commands.js",
    "test": "node --test test/"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "@discordjs/voice": "^0.18.0",
    "discord.js": "^14.16.0",
    "dotenv": "^16.4.5",
    "sodium-native": "^4.3.1"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.env
.DS_Store
npm-debug.log*
```

- [ ] **Step 3: Create `.env.example`**

```
DISCORD_TOKEN=your-bot-token-here
CLIENT_ID=your-application-id-here
```

- [ ] **Step 4: Create `README.md`**

```markdown
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
```

- [ ] **Step 5: Create `src/index.js` (minimal boot for now)**

```javascript
import 'dotenv/config'

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment')
  process.exit(1)
}

console.log('olulu-muse booting...')
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: `node_modules/` populated, no fatal errors.

- [ ] **Step 7: Smoke test**

Run: `DISCORD_TOKEN=x CLIENT_ID=y npm start`
Expected: prints `olulu-muse booting...` and exits cleanly.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example README.md src/index.js
git commit -m "chore: project scaffold with deps and env loader"
```

---

### Task 2: `Track` type + `SourceError`

**Files:**
- Create: `src/sources/errors.js`
- Create: `src/sources/track.js`
- Create: `test/sources/track.test.js`

**Interfaces:**
- Consumes: (none)
- Produces:
  - `class SourceError extends Error` (from `src/sources/errors.js`)
  - `Track` shape: `{ title: string, url: string, durationSec: number, thumbnailUrl: string|null, requestedBy: { id: string, tag: string } }`
  - `createTrack({ title, url, durationSec, thumbnailUrl, requestedBy }): Track` factory

- [ ] **Step 1: Write failing test**

```javascript
// test/sources/track.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTrack } from '../../src/sources/track.js'
import { SourceError } from '../../src/sources/errors.js'

test('createTrack returns a Track with required fields', () => {
  const t = createTrack({
    title: 'Song',
    url: 'https://youtu.be/abc',
    durationSec: 200,
    thumbnailUrl: 'https://img/thumb.jpg',
    requestedBy: { id: '1', tag: 'user#0001' },
  })
  assert.equal(t.title, 'Song')
  assert.equal(t.url, 'https://youtu.be/abc')
  assert.equal(t.durationSec, 200)
  assert.equal(t.thumbnailUrl, 'https://img/thumb.jpg')
  assert.deepEqual(t.requestedBy, { id: '1', tag: 'user#0001' })
})

test('createTrack throws on missing required fields', () => {
  assert.throws(() => createTrack({ title: 'x' }), /required/)
})

test('SourceError has expected name and message', () => {
  const e = new SourceError('nope')
  assert.equal(e.name, 'SourceError')
  assert.equal(e.message, 'nope')
  assert.ok(e instanceof Error)
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL (`SourceError`/`createTrack` not defined).

- [ ] **Step 3: Implement `SourceError`**

```javascript
// src/sources/errors.js
export class SourceError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SourceError'
  }
}
```

- [ ] **Step 4: Implement `createTrack`**

```javascript
// src/sources/track.js
export function createTrack({ title, url, durationSec, thumbnailUrl = null, requestedBy }) {
  if (!title || !url || typeof durationSec !== 'number' || !requestedBy) {
    throw new Error('createTrack: title, url, durationSec, requestedBy are required')
  }
  return { title, url, durationSec, thumbnailUrl, requestedBy }
}
```

- [ ] **Step 5: Run tests — expect pass**

Run: `npm test`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add src/sources/errors.js src/sources/track.js test/sources/track.test.js
git commit -m "feat(sources): add Track factory and SourceError"
```

---

### Task 3: `sources/youtube.js` — resolve()

**Files:**
- Create: `src/sources/youtube.js`
- Create: `test/sources/youtube.resolve.test.js`

**Interfaces:**
- Consumes: `SourceError` from `src/sources/errors.js`; `createTrack` from `src/sources/track.js`
- Produces:
  - `resolve(query: string, requestedBy: { id, tag }): Promise<Track[]>` — spawns `yt-dlp`, returns array of length 1
  - URL regex: `/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i`
  - Injectable spawn (default `child_process.spawn`) for testability: `resolve(query, requestedBy, { spawn })`

- [ ] **Step 1: Write failing tests**

```javascript
// test/sources/youtube.resolve.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { resolve } from '../../src/sources/youtube.js'
import { SourceError } from '../../src/sources/errors.js'

function fakeSpawn({ stdout = '', stderr = '', code = 0 } = {}) {
  const calls = []
  const spawn = (cmd, args) => {
    calls.push({ cmd, args })
    const child = new EventEmitter()
    child.stdout = Readable.from([stdout])
    child.stderr = Readable.from([stderr])
    setImmediate(() => child.emit('close', code))
    return child
  }
  spawn.calls = calls
  return spawn
}

const requestedBy = { id: '1', tag: 'u#0001' }

const sampleJson = JSON.stringify({
  title: 'Song',
  webpage_url: 'https://youtu.be/abc',
  duration: 200,
  thumbnail: 'https://img/t.jpg',
})

test('resolve with URL invokes yt-dlp with URL', async () => {
  const spawn = fakeSpawn({ stdout: sampleJson })
  const tracks = await resolve('https://youtu.be/abc', requestedBy, { spawn })
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].title, 'Song')
  assert.equal(tracks[0].url, 'https://youtu.be/abc')
  assert.equal(tracks[0].durationSec, 200)
  assert.equal(spawn.calls[0].cmd, 'yt-dlp')
  assert.ok(spawn.calls[0].args.includes('https://youtu.be/abc'))
  assert.ok(spawn.calls[0].args.includes('--dump-single-json'))
})

test('resolve with keywords uses ytsearch1 prefix', async () => {
  const spawn = fakeSpawn({ stdout: sampleJson })
  await resolve('rick astley never gonna', requestedBy, { spawn })
  assert.ok(spawn.calls[0].args.includes('ytsearch1:rick astley never gonna'))
})

test('resolve throws SourceError on non-zero exit', async () => {
  const spawn = fakeSpawn({ stderr: 'ERROR: video unavailable', code: 1 })
  await assert.rejects(
    resolve('https://youtu.be/abc', requestedBy, { spawn }),
    (err) => err instanceof SourceError && /video unavailable/i.test(err.message),
  )
})

test('resolve throws SourceError on invalid JSON', async () => {
  const spawn = fakeSpawn({ stdout: 'not json', code: 0 })
  await assert.rejects(
    resolve('https://youtu.be/abc', requestedBy, { spawn }),
    SourceError,
  )
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL (`resolve` not exported).

- [ ] **Step 3: Implement `resolve`**

```javascript
// src/sources/youtube.js
import { spawn as defaultSpawn } from 'node:child_process'
import { createTrack } from './track.js'
import { SourceError } from './errors.js'

const YT_URL = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i

function collect(stream) {
  return new Promise((resolveP, rejectP) => {
    const chunks = []
    stream.on('data', (c) => chunks.push(c))
    stream.on('end', () => resolveP(Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')))
    stream.on('error', rejectP)
  })
}

export async function resolve(query, requestedBy, { spawn = defaultSpawn } = {}) {
  const target = YT_URL.test(query) ? query : `ytsearch1:${query}`
  const args = ['--no-playlist', '--dump-single-json', target]
  const child = spawn('yt-dlp', args)
  const [stdout, stderr, code] = await Promise.all([
    collect(child.stdout),
    collect(child.stderr),
    new Promise((r) => child.on('close', r)),
  ])
  if (code !== 0) {
    throw new SourceError(stderr.trim() || `yt-dlp exited with code ${code}`)
  }
  let json
  try {
    json = JSON.parse(stdout)
  } catch {
    throw new SourceError('yt-dlp returned invalid JSON')
  }
  return [
    createTrack({
      title: json.title,
      url: json.webpage_url,
      durationSec: json.duration ?? 0,
      thumbnailUrl: json.thumbnail ?? null,
      requestedBy,
    }),
  ]
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 4 new passing + prior tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/sources/youtube.js test/sources/youtube.resolve.test.js
git commit -m "feat(sources): resolve() shells out to yt-dlp for URL/keyword lookup"
```

---

### Task 4: `sources/youtube.js` — stream()

**Files:**
- Modify: `src/sources/youtube.js`
- Create: `test/sources/youtube.stream.test.js`

**Interfaces:**
- Consumes: (none new)
- Produces: `stream(track: Track, { spawn }?): Readable` — returns the yt-dlp child's stdout stream.

- [ ] **Step 1: Write failing test**

```javascript
// test/sources/youtube.stream.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { stream } from '../../src/sources/youtube.js'

function fakeSpawn() {
  const calls = []
  const spawn = (cmd, args) => {
    calls.push({ cmd, args })
    const child = new EventEmitter()
    child.stdout = Readable.from(['audio-bytes'])
    child.stderr = Readable.from([''])
    return child
  }
  spawn.calls = calls
  return spawn
}

test('stream invokes yt-dlp with -o - and bestaudio format', () => {
  const spawn = fakeSpawn()
  const s = stream({ url: 'https://youtu.be/abc' }, { spawn })
  assert.ok(s)
  assert.equal(spawn.calls[0].cmd, 'yt-dlp')
  assert.ok(spawn.calls[0].args.includes('-o'))
  assert.ok(spawn.calls[0].args.includes('-'))
  assert.ok(spawn.calls[0].args.includes('-f'))
  assert.ok(spawn.calls[0].args.includes('bestaudio'))
  assert.ok(spawn.calls[0].args.includes('--no-playlist'))
  assert.ok(spawn.calls[0].args.includes('https://youtu.be/abc'))
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test`
Expected: FAIL (`stream` not exported).

- [ ] **Step 3: Add `stream()` to `src/sources/youtube.js`**

Append to `src/sources/youtube.js`:

```javascript
export function stream(track, { spawn = defaultSpawn } = {}) {
  const args = ['-o', '-', '-f', 'bestaudio', '--no-playlist', track.url]
  const child = spawn('yt-dlp', args)
  return child.stdout
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/sources/youtube.js test/sources/youtube.stream.test.js
git commit -m "feat(sources): stream() returns yt-dlp stdout for playback"
```

---

### Task 5: `GuildPlayer` — construction, queue, and shuffle

**Files:**
- Create: `src/player/guildPlayer.js`
- Create: `test/player/guildPlayer.queue.test.js`

**Interfaces:**
- Consumes: `Track` shape, `sources/youtube.stream`
- Produces:
  - `class GuildPlayer` with constructor `({ guildId, textChannelId, deps })`
  - State: `queue`, `current`, `loopMode`, `volume`
  - Methods: `enqueue(tracks)`, `getState()`, `shuffle()`, `setLoop(mode)`, `setVolume(n)` (clamped 0..200)
  - `deps` object (for tests): `{ voice, source, now }` — deferred wiring; construction here does NOT touch the network or Discord.

- [ ] **Step 1: Write failing tests**

```javascript
// test/player/guildPlayer.queue.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GuildPlayer } from '../../src/player/guildPlayer.js'

function makePlayer() {
  const started = []
  const deps = {
    voice: {
      join: () => ({}),
      createPlayer: () => ({
        on: () => {},
        play: (r) => started.push(r),
        stop: () => {},
        pause: () => {},
        unpause: () => {},
      }),
      createResource: (input, opts) => ({ input, opts, volume: { setVolume: () => {} } }),
      subscribe: () => {},
      destroy: () => {},
    },
    source: {
      stream: (t) => ({ track: t }),
    },
  }
  return { player: new GuildPlayer({ guildId: 'g', textChannelId: 't', deps }), started }
}

const track = (n) => ({
  title: `t${n}`,
  url: `https://youtu.be/${n}`,
  durationSec: 100,
  thumbnailUrl: null,
  requestedBy: { id: 'u', tag: 'u#0001' },
})

test('enqueue with idle player buffers tracks (playback deferred until connect)', () => {
  const { player } = makePlayer()
  player.enqueue([track(1), track(2)])
  const s = player.getState()
  assert.equal(s.current, null)
  assert.deepEqual(s.queue.map((t) => t.title), ['t1', 't2'])
})

test('setLoop stores mode', () => {
  const { player } = makePlayer()
  player.setLoop('track')
  assert.equal(player.getState().loopMode, 'track')
})

test('setLoop rejects invalid mode', () => {
  const { player } = makePlayer()
  assert.throws(() => player.setLoop('backwards'), /loopMode/)
})

test('setVolume clamps to 0..200', () => {
  const { player } = makePlayer()
  player.setVolume(300)
  assert.equal(player.getState().volume, 200)
  player.setVolume(-5)
  assert.equal(player.getState().volume, 0)
  player.setVolume(120)
  assert.equal(player.getState().volume, 120)
})

test('shuffle reorders queue but keeps current untouched', () => {
  const { player } = makePlayer()
  player.enqueue([track(1), track(2), track(3), track(4), track(5)])
  const before = player.getState().queue.map((t) => t.title)
  player.shuffle()
  const after = player.getState().queue.map((t) => t.title)
  assert.equal(after.length, before.length)
  assert.deepEqual([...after].sort(), [...before].sort())
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL (`GuildPlayer` not defined).

- [ ] **Step 3: Implement `GuildPlayer` (partial: no playback yet)**

```javascript
// src/player/guildPlayer.js
const VALID_LOOP_MODES = new Set(['off', 'track', 'queue'])

export class GuildPlayer {
  constructor({ guildId, textChannelId, deps }) {
    this.guildId = guildId
    this.textChannelId = textChannelId
    this.deps = deps
    this.queue = []
    this.current = null
    this.loopMode = 'off'
    this.volume = 100
    this.voiceConnection = null
    this.audioPlayer = null
    this.currentResource = null
  }

  getState() {
    return {
      queue: [...this.queue],
      current: this.current,
      loopMode: this.loopMode,
      volume: this.volume,
    }
  }

  enqueue(tracks) {
    this.queue.push(...tracks)
    if (!this.current && this.audioPlayer) {
      this._playNext()
    }
  }

  setLoop(mode) {
    if (!VALID_LOOP_MODES.has(mode)) {
      throw new Error(`invalid loopMode: ${mode}`)
    }
    this.loopMode = mode
  }

  setVolume(n) {
    this.volume = Math.max(0, Math.min(200, n))
    if (this.currentResource?.volume) {
      this.currentResource.volume.setVolume(this.volume / 100)
    }
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]
    }
  }

  _playNext() {
    // Implemented in Task 6.
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: 5 new passing + prior tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/player/guildPlayer.js test/player/guildPlayer.queue.test.js
git commit -m "feat(player): GuildPlayer with queue, loop, volume, shuffle"
```

---

### Task 6: `GuildPlayer` — playback loop with loop-mode semantics

**Files:**
- Modify: `src/player/guildPlayer.js`
- Create: `test/player/guildPlayer.playback.test.js`

**Interfaces:**
- Consumes: `deps.voice.createPlayer` returns an object with `on(event, cb)`, `play(resource)`, `stop()`, `pause()`, `unpause()`. `deps.voice.createResource(readable, { inlineVolume })` returns `{ volume: { setVolume(x) } }`. `deps.source.stream(track)` returns a Readable-like.
- Produces:
  - `connect(voiceChannel)` — creates voice connection via `deps.voice.join(voiceChannel)`, creates audio player, wires `stateChange` listener that calls `_playNext()` on Idle
  - `_playNext()` honors `loopMode`
  - `skip()`, `pause()`, `resume()`, `stop()` (clears queue, stops), and `destroy()`
  - `deps.postEmbed(kind, payload)` hook (optional; no-op in tests when absent) — called with `{ kind: 'now-playing'|'track-error', track }`

- [ ] **Step 1: Write failing tests**

```javascript
// test/player/guildPlayer.playback.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GuildPlayer } from '../../src/player/guildPlayer.js'

function makeDeps() {
  const played = []
  const events = {}
  const audioPlayer = {
    on: (event, cb) => { events[event] = cb },
    play: (r) => { played.push(r) },
    stop: () => { events.stateChange?.({ status: 'playing' }, { status: 'idle' }) },
    pause: () => {},
    unpause: () => {},
  }
  const deps = {
    voice: {
      join: () => ({ subscribe: () => {}, destroy: () => {} }),
      createPlayer: () => audioPlayer,
      createResource: (input, opts) => ({ input, opts, volume: { setVolume: () => {} } }),
      subscribe: () => {},
    },
    source: {
      stream: (t) => ({ __track: t }),
    },
    postEmbed: () => {},
  }
  return { deps, played, events, audioPlayer }
}

const track = (n) => ({
  title: `t${n}`,
  url: `https://youtu.be/${n}`,
  durationSec: 100,
  thumbnailUrl: null,
  requestedBy: { id: 'u', tag: 'u#0001' },
})

function fireIdle(events) {
  events.stateChange({ status: 'playing' }, { status: 'idle' })
}

test('connect + enqueue starts playing first track', () => {
  const { deps, played } = makeDeps()
  const p = new GuildPlayer({ guildId: 'g', textChannelId: 't', deps })
  p.connect({})
  p.enqueue([track(1), track(2)])
  assert.equal(played.length, 1)
  assert.equal(played[0].input.__track.title, 't1')
  assert.equal(p.getState().current.title, 't1')
  assert.deepEqual(p.getState().queue.map((t) => t.title), ['t2'])
})

test('on Idle, advances to next track', () => {
  const { deps, played, events } = makeDeps()
  const p = new GuildPlayer({ guildId: 'g', textChannelId: 't', deps })
  p.connect({})
  p.enqueue([track(1), track(2)])
  fireIdle(events)
  assert.equal(played.length, 2)
  assert.equal(p.getState().current.title, 't2')
})

test('loopMode=track repeats current on Idle', () => {
  const { deps, played, events } = makeDeps()
  const p = new GuildPlayer({ guildId: 'g', textChannelId: 't', deps })
  p.connect({})
  p.enqueue([track(1), track(2)])
  p.setLoop('track')
  fireIdle(events)
  assert.equal(played.length, 2)
  assert.equal(p.getState().current.title, 't1')
  assert.deepEqual(p.getState().queue.map((t) => t.title), ['t2'])
})

test('loopMode=queue pushes finished track to end', () => {
  const { deps, played, events } = makeDeps()
  const p = new GuildPlayer({ guildId: 'g', textChannelId: 't', deps })
  p.connect({})
  p.enqueue([track(1), track(2)])
  p.setLoop('queue')
  fireIdle(events)
  assert.equal(p.getState().current.title, 't2')
  assert.deepEqual(p.getState().queue.map((t) => t.title), ['t1'])
})

test('loopMode=off with empty queue goes idle', () => {
  const { deps, events } = makeDeps()
  const p = new GuildPlayer({ guildId: 'g', textChannelId: 't', deps })
  p.connect({})
  p.enqueue([track(1)])
  fireIdle(events)
  assert.equal(p.getState().current, null)
  assert.equal(p.getState().queue.length, 0)
})

test('skip advances to next track', () => {
  const { deps, events, played } = makeDeps()
  const p = new GuildPlayer({ guildId: 'g', textChannelId: 't', deps })
  p.connect({})
  p.enqueue([track(1), track(2)])
  // stop() triggers Idle event via our fake audioPlayer; skip must do the same
  p.skip()
  assert.equal(p.getState().current.title, 't2')
  assert.equal(played.length, 2)
})

test('stop clears queue and current', () => {
  const { deps } = makeDeps()
  const p = new GuildPlayer({ guildId: 'g', textChannelId: 't', deps })
  p.connect({})
  p.enqueue([track(1), track(2), track(3)])
  p.stop()
  assert.equal(p.getState().current, null)
  assert.equal(p.getState().queue.length, 0)
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL (playback methods not implemented).

- [ ] **Step 3: Replace `src/player/guildPlayer.js`**

```javascript
// src/player/guildPlayer.js
const VALID_LOOP_MODES = new Set(['off', 'track', 'queue'])

export class GuildPlayer {
  constructor({ guildId, textChannelId, deps }) {
    this.guildId = guildId
    this.textChannelId = textChannelId
    this.deps = deps
    this.queue = []
    this.current = null
    this.loopMode = 'off'
    this.volume = 100
    this.voiceConnection = null
    this.audioPlayer = null
    this.currentResource = null
  }

  getState() {
    return {
      queue: [...this.queue],
      current: this.current,
      loopMode: this.loopMode,
      volume: this.volume,
    }
  }

  connect(voiceChannel) {
    if (this.audioPlayer) return
    this.voiceConnection = this.deps.voice.join(voiceChannel)
    this.audioPlayer = this.deps.voice.createPlayer()
    this.audioPlayer.on('stateChange', (oldS, newS) => {
      if (oldS.status !== 'idle' && newS.status === 'idle') {
        this._onTrackEnd()
      }
    })
    this.audioPlayer.on('error', (err) => {
      this._log('audioPlayer error', err)
      this._onTrackEnd({ errored: true })
    })
    this.voiceConnection.subscribe?.(this.audioPlayer)
  }

  enqueue(tracks) {
    this.queue.push(...tracks)
    if (!this.current && this.audioPlayer) {
      this._playNext()
    }
  }

  setLoop(mode) {
    if (!VALID_LOOP_MODES.has(mode)) {
      throw new Error(`invalid loopMode: ${mode}`)
    }
    this.loopMode = mode
  }

  setVolume(n) {
    this.volume = Math.max(0, Math.min(200, n))
    if (this.currentResource?.volume) {
      this.currentResource.volume.setVolume(this.volume / 100)
    }
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]
    }
  }

  skip() {
    if (this.audioPlayer && this.current) {
      this.audioPlayer.stop()
    }
  }

  pause() {
    this.audioPlayer?.pause()
  }

  resume() {
    this.audioPlayer?.unpause()
  }

  stop() {
    this.queue = []
    this.current = null
    this.audioPlayer?.stop()
  }

  destroy() {
    this.queue = []
    this.current = null
    try { this.audioPlayer?.stop() } catch {}
    try { this.voiceConnection?.destroy?.() } catch {}
    this.audioPlayer = null
    this.voiceConnection = null
  }

  _onTrackEnd({ errored = false } = {}) {
    const finished = this.current
    this.current = null
    this.currentResource = null
    if (finished && !errored) {
      if (this.loopMode === 'track') {
        this.queue.unshift(finished)
      } else if (this.loopMode === 'queue') {
        this.queue.push(finished)
      }
    }
    this._playNext()
  }

  _playNext() {
    if (!this.audioPlayer) return
    if (this.queue.length === 0) {
      this.current = null
      return
    }
    const next = this.queue.shift()
    this.current = next
    try {
      const stream = this.deps.source.stream(next)
      const resource = this.deps.voice.createResource(stream, { inlineVolume: true })
      resource.volume?.setVolume(this.volume / 100)
      this.currentResource = resource
      this.audioPlayer.play(resource)
      this.deps.postEmbed?.({ kind: 'now-playing', track: next })
    } catch (err) {
      this._log('failed to play track', err)
      this.deps.postEmbed?.({ kind: 'track-error', track: next, error: err })
      this.current = null
      this._playNext()
    }
  }

  _log(msg, err) {
    // eslint-disable-next-line no-console
    console.error(`[guildId=${this.guildId}] ${msg}`, err?.message ?? '')
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: all passing (7 new + prior).

- [ ] **Step 5: Commit**

```bash
git add src/player/guildPlayer.js test/player/guildPlayer.playback.test.js
git commit -m "feat(player): playback loop with skip/pause/stop and loop modes"
```

---

### Task 7: Registry

**Files:**
- Create: `src/player/registry.js`
- Create: `test/player/registry.test.js`

**Interfaces:**
- Consumes: `GuildPlayer`
- Produces:
  - `class Registry` with `constructor({ createPlayer })` where `createPlayer({ guildId, textChannelId })` returns a `GuildPlayer`-like object (the real factory will inject Discord deps)
  - `getOrCreate(guildId, textChannelId)`, `get(guildId)`, `destroy(guildId)`
  - `destroy` calls `player.destroy()` and removes from the map

- [ ] **Step 1: Write failing tests**

```javascript
// test/player/registry.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Registry } from '../../src/player/registry.js'

function fakePlayerFactory() {
  const created = []
  return {
    factory: ({ guildId, textChannelId }) => {
      const p = { guildId, textChannelId, destroyed: false, destroy() { this.destroyed = true } }
      created.push(p)
      return p
    },
    created,
  }
}

test('getOrCreate returns the same player for the same guild', () => {
  const { factory } = fakePlayerFactory()
  const r = new Registry({ createPlayer: factory })
  const a = r.getOrCreate('g1', 't1')
  const b = r.getOrCreate('g1', 'txn-later')
  assert.equal(a, b)
})

test('get returns undefined for unknown guild', () => {
  const { factory } = fakePlayerFactory()
  const r = new Registry({ createPlayer: factory })
  assert.equal(r.get('nope'), undefined)
})

test('destroy calls player.destroy and removes from registry', () => {
  const { factory } = fakePlayerFactory()
  const r = new Registry({ createPlayer: factory })
  const p = r.getOrCreate('g1', 't1')
  r.destroy('g1')
  assert.equal(p.destroyed, true)
  assert.equal(r.get('g1'), undefined)
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL (`Registry` not defined).

- [ ] **Step 3: Implement `Registry`**

```javascript
// src/player/registry.js
export class Registry {
  constructor({ createPlayer }) {
    this._createPlayer = createPlayer
    this._players = new Map()
  }

  getOrCreate(guildId, textChannelId) {
    let p = this._players.get(guildId)
    if (!p) {
      p = this._createPlayer({ guildId, textChannelId })
      this._players.set(guildId, p)
    }
    return p
  }

  get(guildId) {
    return this._players.get(guildId)
  }

  destroy(guildId) {
    const p = this._players.get(guildId)
    if (p) {
      try { p.destroy() } catch {}
      this._players.delete(guildId)
    }
  }

  all() {
    return [...this._players.values()]
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/player/registry.js test/player/registry.test.js
git commit -m "feat(player): Registry maintains per-guild player instances"
```

---

### Task 8: Idle (leave-when-alone) helper

**Files:**
- Create: `src/player/idle.js`
- Create: `test/player/idle.test.js`

**Interfaces:**
- Consumes: `Registry`
- Produces:
  - `createIdleWatcher({ registry, timeoutMs = 30_000, botUserId, timers })` returning `{ handleVoiceStateUpdate(oldState, newState) }`
  - `oldState` and `newState` shape (subset we use): `{ guild: { id, members: { cache: Map<userId, { user: { bot } }> } }, channelId: string|null }`
  - The bot's own current voice channel is retrieved via `registry.get(guildId).voiceConnection?.joinConfig?.channelId` — but for testability the watcher accepts a `getBotChannelId(guildId)` function on `deps`, defaulting to that path.

- [ ] **Step 1: Write failing tests**

```javascript
// test/player/idle.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createIdleWatcher } from '../../src/player/idle.js'

function fakeTimers() {
  let now = 0
  const scheduled = []
  return {
    setTimeout: (cb, ms) => {
      const id = scheduled.length
      scheduled.push({ cb, ms, cleared: false })
      return id
    },
    clearTimeout: (id) => { if (scheduled[id]) scheduled[id].cleared = true },
    advance: (ms) => {
      now += ms
      for (const s of scheduled) {
        if (!s.cleared && !s.fired && s.ms <= ms) {
          s.fired = true
          s.cb()
        }
      }
    },
    scheduled,
  }
}

function guildState({ members }) {
  return {
    guild: { id: 'g1', members: { cache: new Map(members.map((m) => [m.id, m])) } },
    channelId: 'v1',
  }
}

const humansOnly = () => guildState({ members: [{ id: 'bot', user: { bot: true } }, { id: 'u1', user: { bot: false } }] })
const botAlone = () => guildState({ members: [{ id: 'bot', user: { bot: true } }] })

test('starts timer when bot is alone', () => {
  const destroyed = []
  const registry = { get: () => ({}), destroy: (id) => destroyed.push(id) }
  const timers = fakeTimers()
  const watcher = createIdleWatcher({
    registry,
    botUserId: 'bot',
    timeoutMs: 30_000,
    timers,
    getBotChannelId: () => 'v1',
  })
  watcher.handleVoiceStateUpdate(humansOnly(), botAlone())
  assert.equal(timers.scheduled.length, 1)
  timers.advance(30_000)
  assert.deepEqual(destroyed, ['g1'])
})

test('clears timer when human rejoins', () => {
  const destroyed = []
  const registry = { get: () => ({}), destroy: (id) => destroyed.push(id) }
  const timers = fakeTimers()
  const watcher = createIdleWatcher({
    registry,
    botUserId: 'bot',
    timeoutMs: 30_000,
    timers,
    getBotChannelId: () => 'v1',
  })
  watcher.handleVoiceStateUpdate(humansOnly(), botAlone())
  watcher.handleVoiceStateUpdate(botAlone(), humansOnly())
  timers.advance(30_000)
  assert.equal(destroyed.length, 0)
})

test('no-op when bot has no player in that guild', () => {
  const registry = { get: () => undefined, destroy: () => { throw new Error('should not destroy') } }
  const timers = fakeTimers()
  const watcher = createIdleWatcher({
    registry,
    botUserId: 'bot',
    timeoutMs: 30_000,
    timers,
    getBotChannelId: () => null,
  })
  watcher.handleVoiceStateUpdate(humansOnly(), botAlone())
  assert.equal(timers.scheduled.length, 0)
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `createIdleWatcher`**

```javascript
// src/player/idle.js
export function createIdleWatcher({
  registry,
  botUserId,
  timeoutMs = 30_000,
  timers = { setTimeout, clearTimeout },
  getBotChannelId,
}) {
  const timerByGuild = new Map()

  const defaultGetBotChannelId = (guildId) => {
    const p = registry.get(guildId)
    return p?.voiceConnection?.joinConfig?.channelId ?? null
  }
  const resolveBotChannel = getBotChannelId ?? defaultGetBotChannelId

  function humansInChannel(state, channelId) {
    if (!channelId) return 0
    let count = 0
    for (const m of state.guild.members.cache.values()) {
      if (m.user?.bot) continue
      if (m.voice?.channelId === channelId) count++
    }
    return count
  }

  function countHumansUsingStateShim(state, channelId) {
    // Fallback for tests: iterate members that share the given channelId if voice-level info missing.
    let count = 0
    for (const m of state.guild.members.cache.values()) {
      if (m.user?.bot) continue
      const memberChannel = m.voice?.channelId ?? state.channelId
      if (memberChannel === channelId) count++
    }
    return count
  }

  function handleVoiceStateUpdate(oldState, newState) {
    const guildId = newState.guild.id
    if (!registry.get(guildId)) return
    const botChannelId = resolveBotChannel(guildId) ?? newState.channelId ?? oldState.channelId
    if (!botChannelId) return

    const humans = humansInChannel(newState, botChannelId) || countHumansUsingStateShim(newState, botChannelId)
    if (humans === 0) {
      if (!timerByGuild.has(guildId)) {
        const id = timers.setTimeout(() => {
          timerByGuild.delete(guildId)
          registry.destroy(guildId)
        }, timeoutMs)
        timerByGuild.set(guildId, id)
      }
    } else {
      const id = timerByGuild.get(guildId)
      if (id !== undefined) {
        timers.clearTimeout(id)
        timerByGuild.delete(guildId)
      }
    }
  }

  return { handleVoiceStateUpdate }
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/player/idle.js test/player/idle.test.js
git commit -m "feat(player): leave-when-alone watcher with 30s timer"
```

---

### Task 9: Command registry + `/ping` smoke command

**Files:**
- Create: `src/commands/index.js`
- Create: `src/commands/ping.js`
- Create: `src/bot/handlers.js`
- Create: `test/bot/handlers.test.js`

**Interfaces:**
- Consumes: none new
- Produces:
  - Each command module exports `{ data, execute }` where `data` is a `SlashCommandBuilder` (or plain object with `.toJSON()`) and `execute(interaction, ctx)` returns a Promise
  - `commands` — `Map<name, module>` exported by `src/commands/index.js`
  - `createHandler({ commands, ctx })` — returns an `async function(interaction)` that dispatches by name, ephemeral error reply on throw

- [ ] **Step 1: Write failing tests**

```javascript
// test/bot/handlers.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../../src/bot/handlers.js'

function fakeInteraction({ name, isCommand = true }) {
  const state = { replied: null, ephemeral: null, deferred: false }
  return {
    isChatInputCommand: () => isCommand,
    commandName: name,
    reply: async (opts) => {
      state.replied = opts.content ?? opts
      state.ephemeral = opts.flags === 64 || opts.ephemeral === true
    },
    followUp: async (opts) => { state.replied = opts.content ?? opts },
    deferReply: async () => { state.deferred = true },
    _state: state,
  }
}

test('dispatches to matching command', async () => {
  const commands = new Map([
    ['hello', { execute: async (i) => i.reply({ content: 'hi' }) }],
  ])
  const handler = createHandler({ commands, ctx: {} })
  const i = fakeInteraction({ name: 'hello' })
  await handler(i)
  assert.equal(i._state.replied, 'hi')
})

test('ignores non-chat-input interactions', async () => {
  const commands = new Map()
  const handler = createHandler({ commands, ctx: {} })
  const i = fakeInteraction({ name: 'x', isCommand: false })
  await handler(i)
  assert.equal(i._state.replied, null)
})

test('unknown command replies ephemerally', async () => {
  const commands = new Map()
  const handler = createHandler({ commands, ctx: {} })
  const i = fakeInteraction({ name: 'unknown' })
  await handler(i)
  assert.match(i._state.replied, /unknown/i)
  assert.equal(i._state.ephemeral, true)
})

test('command throwing produces ephemeral error reply', async () => {
  const commands = new Map([
    ['boom', { execute: async () => { throw new Error('kaboom') } }],
  ])
  const handler = createHandler({ commands, ctx: {} })
  const i = fakeInteraction({ name: 'boom' })
  await handler(i)
  assert.match(i._state.replied, /something went wrong/i)
  assert.equal(i._state.ephemeral, true)
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `handlers.js`**

```javascript
// src/bot/handlers.js
const EPHEMERAL = 1 << 6 // 64

export function createHandler({ commands, ctx }) {
  return async function handle(interaction) {
    if (!interaction.isChatInputCommand?.()) return
    const cmd = commands.get(interaction.commandName)
    if (!cmd) {
      await interaction.reply({ content: `Unknown command: ${interaction.commandName}`, flags: EPHEMERAL })
      return
    }
    try {
      await cmd.execute(interaction, ctx)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[cmd=${interaction.commandName}] error`, err)
      const payload = { content: 'Something went wrong.', flags: EPHEMERAL }
      if (interaction.deferred || interaction.replied) {
        try { await interaction.followUp(payload) } catch {}
      } else {
        try { await interaction.reply(payload) } catch {}
      }
    }
  }
}
```

- [ ] **Step 4: Implement `ping` command + registry**

```javascript
// src/commands/ping.js
import { SlashCommandBuilder } from 'discord.js'

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check that the bot is alive.')

export async function execute(interaction) {
  await interaction.reply({ content: 'pong', flags: 1 << 6 })
}
```

```javascript
// src/commands/index.js
import * as ping from './ping.js'

export const commands = new Map([
  ['ping', ping],
])
```

- [ ] **Step 5: Run tests — expect pass**

Run: `npm test`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/bot/handlers.js src/commands/index.js src/commands/ping.js test/bot/handlers.test.js
git commit -m "feat(bot): interaction handler + command registry + /ping"
```

---

### Task 10: `/play` command

**Files:**
- Create: `src/commands/play.js`
- Modify: `src/commands/index.js`
- Create: `test/commands/play.test.js`
- Create: `src/bot/embeds.js`

**Interfaces:**
- Consumes: `ctx` shape: `{ registry, resolveTrack: async (query, requestedBy) => Track[], createPlayerForGuild: async (guildId, textChannelId, voiceChannel) => GuildPlayer }` — the last function is provided by wiring in Task 15; for now `play.js` uses `registry.getOrCreate` and expects the player to already be connect-capable via `ctx.connect(player, voiceChannel)`.
- Produces:
  - `/play query:string`
  - On success replies with a "Queued" or "Now playing" embed (`src/bot/embeds.js` provides `trackEmbed(kind, track)`)

- [ ] **Step 1: Write failing tests**

```javascript
// test/commands/play.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as play from '../../src/commands/play.js'

function fakeInteraction({ voiceChannel = { id: 'v1' } } = {}) {
  const replies = []
  return {
    commandName: 'play',
    options: { getString: () => 'never gonna give you up' },
    user: { id: 'u1', tag: 'u#0001' },
    guildId: 'g1',
    channelId: 't1',
    member: { voice: { channel: voiceChannel } },
    deferred: false,
    replied: false,
    deferReply: async function () { this.deferred = true },
    editReply: async (o) => replies.push({ where: 'edit', o }),
    reply: async (o) => replies.push({ where: 'reply', o }),
    followUp: async (o) => replies.push({ where: 'follow', o }),
    _replies: replies,
  }
}

test('play errors when user not in voice channel', async () => {
  const i = fakeInteraction({ voiceChannel: null })
  const ctx = {
    resolveTrack: async () => { throw new Error('should not be called') },
    registry: { getOrCreate: () => { throw new Error('nope') } },
    connect: () => {},
  }
  await play.execute(i, ctx)
  const msg = i._replies.at(-1).o
  assert.match(msg.content ?? '', /voice channel/i)
})

test('play resolves and enqueues, replies with embed', async () => {
  const enqueued = []
  const track = { title: 't1', url: 'https://y/1', durationSec: 100, thumbnailUrl: null, requestedBy: { id: 'u1', tag: 'u#0001' } }
  const player = { enqueue: (ts) => enqueued.push(...ts), getState: () => ({ current: null, queue: [] }) }
  let connected = false
  const ctx = {
    resolveTrack: async (q, rb) => {
      assert.equal(q, 'never gonna give you up')
      assert.equal(rb.id, 'u1')
      return [track]
    },
    registry: { getOrCreate: (g, t) => { assert.equal(g, 'g1'); assert.equal(t, 't1'); return player } },
    connect: (p, ch) => { connected = true; assert.equal(p, player); assert.equal(ch.id, 'v1') },
  }
  const i = fakeInteraction()
  await play.execute(i, ctx)
  assert.deepEqual(enqueued, [track])
  assert.equal(connected, true)
  const last = i._replies.at(-1).o
  const embed = last.embeds?.[0]
  assert.ok(embed, 'expected an embed in reply')
})

test('play surfaces SourceError as ephemeral message', async () => {
  const ctx = {
    resolveTrack: async () => { const e = new Error('video unavailable'); e.name = 'SourceError'; throw e },
    registry: { getOrCreate: () => ({}) },
    connect: () => {},
  }
  const i = fakeInteraction()
  await play.execute(i, ctx)
  const last = i._replies.at(-1).o
  assert.match(last.content ?? '', /video unavailable/i)
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/bot/embeds.js`**

```javascript
// src/bot/embeds.js
import { EmbedBuilder } from 'discord.js'

function fmtDuration(sec) {
  if (!sec || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function trackEmbed(kind, track) {
  const label = kind === 'now-playing' ? '▶ Now playing' : kind === 'queued' ? 'Queued' : kind === 'track-error' ? '⚠ Skipped' : kind
  const e = new EmbedBuilder()
    .setTitle(`${label}: ${track.title}`)
    .setURL(track.url)
    .setDescription(`Duration: ${fmtDuration(track.durationSec)} • Requested by ${track.requestedBy.tag}`)
  if (track.thumbnailUrl) e.setThumbnail(track.thumbnailUrl)
  return e
}
```

- [ ] **Step 4: Implement `play.js`**

```javascript
// src/commands/play.js
import { SlashCommandBuilder } from 'discord.js'
import { trackEmbed } from '../bot/embeds.js'

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a YouTube URL or keyword search.')
  .addStringOption((opt) =>
    opt.setName('query').setDescription('YouTube URL or search terms').setRequired(true),
  )

const EPHEMERAL = 1 << 6

async function safeReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload)
  }
  return interaction.reply(payload)
}

export async function execute(interaction, ctx) {
  const voiceChannel = interaction.member?.voice?.channel
  if (!voiceChannel) {
    return safeReply(interaction, { content: 'Join a voice channel first.', flags: EPHEMERAL })
  }
  const query = interaction.options.getString('query')
  await interaction.deferReply()

  let tracks
  try {
    tracks = await ctx.resolveTrack(query, { id: interaction.user.id, tag: interaction.user.tag })
  } catch (err) {
    const msg = err?.name === 'SourceError' ? err.message : 'Could not resolve that query.'
    return safeReply(interaction, { content: msg, flags: EPHEMERAL })
  }

  const player = ctx.registry.getOrCreate(interaction.guildId, interaction.channelId)
  await ctx.connect(player, voiceChannel)

  const wasIdle = !player.getState().current && player.getState().queue.length === 0
  player.enqueue(tracks)

  const kind = wasIdle ? 'now-playing' : 'queued'
  await safeReply(interaction, { embeds: [trackEmbed(kind, tracks[0])] })
}
```

- [ ] **Step 5: Register in `src/commands/index.js`**

```javascript
// src/commands/index.js
import * as ping from './ping.js'
import * as play from './play.js'

export const commands = new Map([
  ['ping', ping],
  ['play', play],
])
```

- [ ] **Step 6: Run tests — expect pass**

Run: `npm test`
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/bot/embeds.js src/commands/play.js src/commands/index.js test/commands/play.test.js
git commit -m "feat(commands): /play resolves query and enqueues track"
```

---

### Task 11: Simple control commands — /skip, /pause, /resume, /stop, /leave, /shuffle

**Files:**
- Create: `src/commands/skip.js`
- Create: `src/commands/pause.js`
- Create: `src/commands/resume.js`
- Create: `src/commands/stop.js`
- Create: `src/commands/leave.js`
- Create: `src/commands/shuffle.js`
- Modify: `src/commands/index.js`
- Create: `test/commands/controls.test.js`

**Interfaces:**
- Consumes: `ctx.registry`
- Produces: six commands, each ephemeral, no-op friendly ("nothing is playing" when there's no player or nothing to act on).

- [ ] **Step 1: Write failing tests**

```javascript
// test/commands/controls.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as skip from '../../src/commands/skip.js'
import * as pause from '../../src/commands/pause.js'
import * as resume from '../../src/commands/resume.js'
import * as stop from '../../src/commands/stop.js'
import * as leave from '../../src/commands/leave.js'
import * as shuffle from '../../src/commands/shuffle.js'

function makeInteraction() {
  const replies = []
  return {
    guildId: 'g1',
    reply: async (o) => replies.push(o),
    _replies: replies,
  }
}

function fakeRegistry({ player } = {}) {
  return {
    get: () => player,
    destroy: () => { this.destroyed = true },
  }
}

test('skip with no player is ephemeral no-op', async () => {
  const i = makeInteraction()
  await skip.execute(i, { registry: { get: () => undefined } })
  assert.match(i._replies[0].content, /nothing/i)
})

test('skip calls player.skip', async () => {
  const skipped = { called: false }
  const player = { skip: () => { skipped.called = true } }
  const i = makeInteraction()
  await skip.execute(i, { registry: { get: () => player } })
  assert.equal(skipped.called, true)
})

test('pause calls player.pause', async () => {
  let called = false
  const player = { pause: () => { called = true } }
  const i = makeInteraction()
  await pause.execute(i, { registry: { get: () => player } })
  assert.equal(called, true)
})

test('resume calls player.resume', async () => {
  let called = false
  const player = { resume: () => { called = true } }
  const i = makeInteraction()
  await resume.execute(i, { registry: { get: () => player } })
  assert.equal(called, true)
})

test('stop clears queue via player.stop', async () => {
  let called = false
  const player = { stop: () => { called = true } }
  const i = makeInteraction()
  await stop.execute(i, { registry: { get: () => player } })
  assert.equal(called, true)
})

test('leave destroys player in registry', async () => {
  let destroyed = null
  const registry = { get: () => ({}), destroy: (id) => { destroyed = id } }
  const i = makeInteraction()
  await leave.execute(i, { registry })
  assert.equal(destroyed, 'g1')
})

test('shuffle calls player.shuffle', async () => {
  let called = false
  const player = { shuffle: () => { called = true } }
  const i = makeInteraction()
  await shuffle.execute(i, { registry: { get: () => player } })
  assert.equal(called, true)
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement each command**

```javascript
// src/commands/skip.js
import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('skip').setDescription('Skip the current track.')
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  player.skip()
  await interaction.reply({ content: 'Skipped.', flags: EPHEMERAL })
}
```

```javascript
// src/commands/pause.js
import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('pause').setDescription('Pause playback.')
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  player.pause()
  await interaction.reply({ content: 'Paused.', flags: EPHEMERAL })
}
```

```javascript
// src/commands/resume.js
import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('resume').setDescription('Resume playback.')
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  player.resume()
  await interaction.reply({ content: 'Resumed.', flags: EPHEMERAL })
}
```

```javascript
// src/commands/stop.js
import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue.')
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  player.stop()
  await interaction.reply({ content: 'Stopped and cleared queue.', flags: EPHEMERAL })
}
```

```javascript
// src/commands/leave.js
import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('leave').setDescription('Disconnect from the voice channel.')
export async function execute(interaction, { registry }) {
  if (!registry.get(interaction.guildId)) {
    return interaction.reply({ content: 'Not connected.', flags: EPHEMERAL })
  }
  registry.destroy(interaction.guildId)
  await interaction.reply({ content: 'Left the voice channel.', flags: EPHEMERAL })
}
```

```javascript
// src/commands/shuffle.js
import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the upcoming queue.')
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is queued.', flags: EPHEMERAL })
  player.shuffle()
  await interaction.reply({ content: 'Shuffled the queue.', flags: EPHEMERAL })
}
```

- [ ] **Step 4: Register all six**

```javascript
// src/commands/index.js
import * as ping from './ping.js'
import * as play from './play.js'
import * as skip from './skip.js'
import * as pause from './pause.js'
import * as resume from './resume.js'
import * as stop from './stop.js'
import * as leave from './leave.js'
import * as shuffle from './shuffle.js'

export const commands = new Map([
  ['ping', ping],
  ['play', play],
  ['skip', skip],
  ['pause', pause],
  ['resume', resume],
  ['stop', stop],
  ['leave', leave],
  ['shuffle', shuffle],
])
```

- [ ] **Step 5: Run tests — expect pass**

Run: `npm test`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/commands/ test/commands/controls.test.js
git commit -m "feat(commands): skip, pause, resume, stop, leave, shuffle"
```

---

### Task 12: `/loop`, `/volume`, `/queue`, `/nowplaying`

**Files:**
- Create: `src/commands/loop.js`
- Create: `src/commands/volume.js`
- Create: `src/commands/queue.js`
- Create: `src/commands/nowplaying.js`
- Modify: `src/commands/index.js`
- Create: `test/commands/loop-volume-queue.test.js`

**Interfaces:**
- Consumes: `ctx.registry`
- Produces:
  - `/loop mode:string` (choices: off, track, queue) — calls `player.setLoop(mode)`
  - `/volume level:integer` (0..200) — calls `player.setVolume(n)`
  - `/queue` — builds a multi-line embed showing `current` + up to 10 upcoming entries
  - `/nowplaying` — one-embed reply from `trackEmbed('now-playing', current)`

- [ ] **Step 1: Write failing tests**

```javascript
// test/commands/loop-volume-queue.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as loop from '../../src/commands/loop.js'
import * as volume from '../../src/commands/volume.js'
import * as queue from '../../src/commands/queue.js'
import * as nowplaying from '../../src/commands/nowplaying.js'

const track = (n) => ({ title: `t${n}`, url: `https://y/${n}`, durationSec: 60 + n, thumbnailUrl: null, requestedBy: { id: 'u', tag: 'u#0001' } })

function makeInteraction({ optionString, optionInt } = {}) {
  const replies = []
  return {
    guildId: 'g1',
    options: {
      getString: () => optionString,
      getInteger: () => optionInt,
    },
    reply: async (o) => replies.push(o),
    _replies: replies,
  }
}

test('loop sets loopMode', async () => {
  let set = null
  const player = { setLoop: (m) => { set = m }, getState: () => ({ loopMode: 'track' }) }
  const i = makeInteraction({ optionString: 'track' })
  await loop.execute(i, { registry: { get: () => player } })
  assert.equal(set, 'track')
})

test('volume clamps and sets', async () => {
  let set = null
  const player = { setVolume: (n) => { set = n }, getState: () => ({ volume: 120 }) }
  const i = makeInteraction({ optionInt: 120 })
  await volume.execute(i, { registry: { get: () => player } })
  assert.equal(set, 120)
})

test('queue with no player replies ephemerally', async () => {
  const i = makeInteraction()
  await queue.execute(i, { registry: { get: () => undefined } })
  assert.match(i._replies[0].content, /nothing/i)
})

test('queue shows current and upcoming', async () => {
  const player = { getState: () => ({ current: track(1), queue: [track(2), track(3)], loopMode: 'off', volume: 100 }) }
  const i = makeInteraction()
  await queue.execute(i, { registry: { get: () => player } })
  const embed = i._replies[0].embeds[0]
  assert.ok(embed)
  const desc = embed.data?.description ?? embed.description
  assert.match(desc, /t1/)
  assert.match(desc, /t2/)
  assert.match(desc, /t3/)
})

test('nowplaying with no current replies ephemerally', async () => {
  const player = { getState: () => ({ current: null }) }
  const i = makeInteraction()
  await nowplaying.execute(i, { registry: { get: () => player } })
  assert.match(i._replies[0].content, /nothing/i)
})

test('nowplaying returns an embed', async () => {
  const player = { getState: () => ({ current: track(1) }) }
  const i = makeInteraction()
  await nowplaying.execute(i, { registry: { get: () => player } })
  assert.ok(i._replies[0].embeds[0])
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `/loop`**

```javascript
// src/commands/loop.js
import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Set loop mode.')
  .addStringOption((o) =>
    o.setName('mode').setDescription('Loop mode').setRequired(true).addChoices(
      { name: 'off', value: 'off' },
      { name: 'track', value: 'track' },
      { name: 'queue', value: 'queue' },
    ),
  )
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  const mode = interaction.options.getString('mode')
  player.setLoop(mode)
  await interaction.reply({ content: `Loop mode: **${mode}**`, flags: EPHEMERAL })
}
```

- [ ] **Step 4: Implement `/volume`**

```javascript
// src/commands/volume.js
import { SlashCommandBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6
export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set volume (0-200, default 100).')
  .addIntegerOption((o) =>
    o.setName('level').setDescription('0..200').setRequired(true).setMinValue(0).setMaxValue(200),
  )
export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  const level = interaction.options.getInteger('level')
  player.setVolume(level)
  await interaction.reply({ content: `Volume: **${player.getState().volume}**`, flags: EPHEMERAL })
}
```

- [ ] **Step 5: Implement `/queue`**

```javascript
// src/commands/queue.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
const EPHEMERAL = 1 << 6

function fmtDuration(sec) {
  if (!sec || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

export const data = new SlashCommandBuilder().setName('queue').setDescription('Show the current queue.')

export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  if (!player) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  const { current, queue, loopMode, volume } = player.getState()
  const lines = []
  lines.push(current ? `▶ **${current.title}** (${fmtDuration(current.durationSec)})` : '_Nothing playing_')
  const upcoming = queue.slice(0, 10)
  upcoming.forEach((t, idx) => {
    lines.push(`${idx + 1}. ${t.title} (${fmtDuration(t.durationSec)})`)
  })
  if (queue.length > upcoming.length) {
    lines.push(`… and ${queue.length - upcoming.length} more`)
  }
  const embed = new EmbedBuilder()
    .setTitle('Queue')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Loop: ${loopMode} • Volume: ${volume}` })
  await interaction.reply({ embeds: [embed] })
}
```

- [ ] **Step 6: Implement `/nowplaying`**

```javascript
// src/commands/nowplaying.js
import { SlashCommandBuilder } from 'discord.js'
import { trackEmbed } from '../bot/embeds.js'
const EPHEMERAL = 1 << 6

export const data = new SlashCommandBuilder().setName('nowplaying').setDescription('Show the currently playing track.')

export async function execute(interaction, { registry }) {
  const player = registry.get(interaction.guildId)
  const current = player?.getState().current
  if (!current) return interaction.reply({ content: 'Nothing is playing.', flags: EPHEMERAL })
  await interaction.reply({ embeds: [trackEmbed('now-playing', current)] })
}
```

- [ ] **Step 7: Register in `commands/index.js`**

Replace the file:

```javascript
// src/commands/index.js
import * as ping from './ping.js'
import * as play from './play.js'
import * as skip from './skip.js'
import * as pause from './pause.js'
import * as resume from './resume.js'
import * as stop from './stop.js'
import * as leave from './leave.js'
import * as shuffle from './shuffle.js'
import * as loop from './loop.js'
import * as volume from './volume.js'
import * as queue from './queue.js'
import * as nowplaying from './nowplaying.js'

export const commands = new Map([
  ['ping', ping],
  ['play', play],
  ['skip', skip],
  ['pause', pause],
  ['resume', resume],
  ['stop', stop],
  ['leave', leave],
  ['shuffle', shuffle],
  ['loop', loop],
  ['volume', volume],
  ['queue', queue],
  ['nowplaying', nowplaying],
])
```

- [ ] **Step 8: Run tests — expect pass**

Run: `npm test`
Expected: all passing.

- [ ] **Step 9: Commit**

```bash
git add src/commands/ test/commands/loop-volume-queue.test.js
git commit -m "feat(commands): loop, volume, queue, nowplaying"
```

---

### Task 13: Slash-command deployment script

**Files:**
- Create: `scripts/deploy-commands.js`

**Interfaces:**
- Consumes: `commands` from `src/commands/index.js`, env `DISCORD_TOKEN` + `CLIENT_ID`
- Produces: `npm run deploy-commands` PUTs global slash commands to Discord.

- [ ] **Step 1: Write the script**

```javascript
// scripts/deploy-commands.js
import 'dotenv/config'
import { REST, Routes } from 'discord.js'
import { commands } from '../src/commands/index.js'

const { DISCORD_TOKEN, CLIENT_ID } = process.env
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID')
  process.exit(1)
}

const body = [...commands.values()].map((c) => c.data.toJSON())
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN)

try {
  console.log(`Deploying ${body.length} slash commands...`)
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body })
  console.log('Done.')
} catch (err) {
  console.error('Failed to deploy:', err)
  process.exit(1)
}
```

- [ ] **Step 2: Verify script loads (does not deploy without a real token)**

Run: `DISCORD_TOKEN=fake CLIENT_ID=fake node -e "import('./scripts/deploy-commands.js').catch(e => { console.error('IMPORT_ERROR', e.message); process.exit(2) })"`

Expected: Either logs "Deploying N slash commands..." followed by an error from Discord (fake token = 401, which is fine — proves the script wired up correctly), OR exits with code 1 after that error. If it prints `IMPORT_ERROR`, the file has a syntax/import problem and must be fixed.

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy-commands.js
git commit -m "chore: script to deploy slash commands"
```

---

### Task 14: `bot/client.js` + `bot/register.js`

**Files:**
- Create: `src/bot/client.js`

**Interfaces:**
- Consumes: `discord.js`
- Produces: `createClient()` returning a `Client` configured with intents `Guilds`, `GuildVoiceStates`.

- [ ] **Step 1: Implement `src/bot/client.js`**

```javascript
// src/bot/client.js
import { Client, GatewayIntentBits } from 'discord.js'

export function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  })
}
```

- [ ] **Step 2: Quick sanity check (no test needed — thin wrapper)**

Run: `node -e "import('./src/bot/client.js').then(m => { const c = m.createClient(); console.log('client created:', !!c) })"`
Expected: prints `client created: true`.

- [ ] **Step 3: Commit**

```bash
git add src/bot/client.js
git commit -m "feat(bot): Client factory with required intents"
```

---

### Task 15: Wire everything in `src/index.js`

**Files:**
- Modify: `src/index.js`

**Interfaces:**
- Consumes: everything.
- Produces: a running bot.

- [ ] **Step 1: Replace `src/index.js`**

```javascript
// src/index.js
import 'dotenv/config'
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice'
import { createClient } from './bot/client.js'
import { createHandler } from './bot/handlers.js'
import { commands } from './commands/index.js'
import { Registry } from './player/registry.js'
import { GuildPlayer } from './player/guildPlayer.js'
import { createIdleWatcher } from './player/idle.js'
import { resolve as ytResolve, stream as ytStream } from './sources/youtube.js'
import { trackEmbed } from './bot/embeds.js'

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment')
  process.exit(1)
}

process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err))
process.on('uncaughtException', (err) => console.error('uncaughtException:', err))

const client = createClient()

function makePlayerFactory({ client }) {
  return function createPlayer({ guildId, textChannelId }) {
    const deps = {
      voice: {
        join: (voiceChannel) => joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: true,
        }),
        createPlayer: () => createAudioPlayer(),
        createResource: (stream, opts) => createAudioResource(stream, {
          inputType: StreamType.Arbitrary,
          inlineVolume: opts?.inlineVolume ?? true,
        }),
      },
      source: {
        stream: (track) => ytStream(track),
      },
      postEmbed: async ({ kind, track }) => {
        try {
          const channel = await client.channels.fetch(textChannelId)
          await channel?.send({ embeds: [trackEmbed(kind, track)] })
        } catch (err) {
          console.error('postEmbed failed:', err.message)
        }
      },
    }
    return new GuildPlayer({ guildId, textChannelId, deps })
  }
}

const registry = new Registry({ createPlayer: makePlayerFactory({ client }) })

async function connect(player, voiceChannel) {
  if (player.audioPlayer) return
  player.connect(voiceChannel)
  try {
    await entersState(player.voiceConnection, VoiceConnectionStatus.Ready, 20_000)
  } catch (err) {
    console.error(`[guildId=${player.guildId}] voice connect failed:`, err.message)
    registry.destroy(player.guildId)
    throw err
  }
}

const ctx = {
  registry,
  resolveTrack: (query, requestedBy) => ytResolve(query, requestedBy),
  connect,
}

const handler = createHandler({ commands, ctx })

client.on('interactionCreate', handler)

client.once('ready', () => {
  const idle = createIdleWatcher({
    registry,
    botUserId: client.user.id,
    timeoutMs: 30_000,
  })
  client.on('voiceStateUpdate', (oldState, newState) => idle.handleVoiceStateUpdate(oldState, newState))
  console.log(`Logged in as ${client.user.tag}`)
})

client.login(process.env.DISCORD_TOKEN)
```

- [ ] **Step 2: Sanity check — module loads without throwing**

Run: `DISCORD_TOKEN=x CLIENT_ID=y node -e "import('./src/index.js').then(() => { setTimeout(() => process.exit(0), 500) })"`
Expected: no import errors. Discord login will fail with a fake token (that's fine); the point is the file loads cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: wire client, registry, handler, and voice adapter"
```

---

### Task 16: Dockerfile + docker-compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `package.json`, `src/`, `scripts/`
- Produces: `docker compose up -d` runs the bot with `ffmpeg` + `yt-dlp` installed.

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.git
.env
docs
test
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
FROM node:20-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# Install yt-dlp from official release (pinned via always-latest url; override via YTDLP_VERSION build arg if desired)
ARG YTDLP_VERSION=latest
RUN if [ "$YTDLP_VERSION" = "latest" ]; then \
      curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp; \
    else \
      curl -L https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp -o /usr/local/bin/yt-dlp; \
    fi \
 && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

CMD ["node", "src/index.js"]
```

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
services:
  bot:
    build: .
    env_file: .env
    restart: unless-stopped
```

- [ ] **Step 4: Build test (only if Docker is available)**

Run: `docker build -t olulu-muse .`
Expected: successful build. If Docker is not available in the dev environment, skip and document in `README.md`.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "chore: Docker image with ffmpeg + yt-dlp"
```

---

### Task 17: Manual test plan

**Files:**
- Create: `docs/TEST_PLAN.md`

**Interfaces:**
- Consumes: (developer time)
- Produces: a checklist to verify the bot works in a real Discord test guild.

- [ ] **Step 1: Write `docs/TEST_PLAN.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/TEST_PLAN.md
git commit -m "docs: manual test plan"
```

---

## Self-review

**Spec coverage:**
- ✅ `/play` URL + keyword — Task 3, Task 10
- ✅ `/skip`, `/pause`, `/resume`, `/stop`, `/leave`, `/shuffle` — Task 11
- ✅ `/loop off|track|queue`, `/volume`, `/queue`, `/nowplaying` — Task 12
- ✅ Multi-guild via `Registry` — Task 7
- ✅ In-memory only — no persistence anywhere
- ✅ yt-dlp isolation in `sources/youtube.js` — Task 3, 4
- ✅ Leave-when-alone (30s) — Task 8
- ✅ Error handling: SourceError → ephemeral, track failure → skip + embed — Task 6, 10
- ✅ Global safety net — Task 15
- ✅ Slash-command registration script — Task 13
- ✅ Docker deployment — Task 16
- ✅ Unit tests (queue/loop/shuffle/idle/resolve/stream/handlers/commands) — Tasks 2–12
- ✅ Manual test plan — Task 17

**Placeholder scan:** clean — no TBD/TODO tokens; every code step contains full code.

**Type consistency:**
- `Track` shape stable across `createTrack`, `resolve`, `stream`, `GuildPlayer`, embeds, commands ✅
- `GuildPlayer.getState()` return shape (`{ queue, current, loopMode, volume }`) referenced identically in `/queue`, `/loop`, `/volume`, `/nowplaying`, `/play` ✅
- `ctx` shape used by `play.js` (`registry`, `resolveTrack`, `connect`) matches what `src/index.js` builds in Task 15 ✅
- `commands` is a `Map<string, {data, execute}>` consistently ✅
- Loop modes: `'off' | 'track' | 'queue'` string set used everywhere ✅
