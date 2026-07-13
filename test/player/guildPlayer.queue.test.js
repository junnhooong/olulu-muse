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
