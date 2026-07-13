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
