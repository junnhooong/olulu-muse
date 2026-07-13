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
