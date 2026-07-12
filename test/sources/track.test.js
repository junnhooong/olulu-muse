import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTrack } from '../../src/sources/track.js'
import { SourceError } from '../../src/sources/errors.js'

test('createTrack returns a Track with required fields', () => {
  const t = createTrack({
    title: 'Song',
    url: 'https://youtu.be/abc',
    durationSec: 200,
    thumbnailUrl: 'https://img/thumb.jpg',
    requestedBy: { id: '1', tag: 'user#0001' },
  })
  assert.equal(t.title, 'Song')
  assert.equal(t.url, 'https://youtu.be/abc')
  assert.equal(t.durationSec, 200)
  assert.equal(t.thumbnailUrl, 'https://img/thumb.jpg')
  assert.deepEqual(t.requestedBy, { id: '1', tag: 'user#0001' })
})

test('createTrack throws on missing required fields', () => {
  assert.throws(() => createTrack({ title: 'x' }), /required/)
})

test('SourceError has expected name and message', () => {
  const e = new SourceError('nope')
  assert.equal(e.name, 'SourceError')
  assert.equal(e.message, 'nope')
  assert.ok(e instanceof Error)
})
