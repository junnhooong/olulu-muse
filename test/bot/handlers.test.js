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
