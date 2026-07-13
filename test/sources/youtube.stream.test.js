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
