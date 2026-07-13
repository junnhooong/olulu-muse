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
