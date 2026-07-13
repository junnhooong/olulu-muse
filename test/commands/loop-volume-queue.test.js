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
