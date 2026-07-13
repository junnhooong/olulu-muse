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
