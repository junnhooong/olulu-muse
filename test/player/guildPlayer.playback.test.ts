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
