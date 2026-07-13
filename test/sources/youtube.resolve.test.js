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
