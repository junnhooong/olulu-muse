export function createTrack({ title, url, durationSec, thumbnailUrl = null, requestedBy }) {
  if (!title || !url || typeof durationSec !== 'number' || !requestedBy) {
    throw new Error('createTrack: title, url, durationSec, requestedBy are required')
  }
  return { title, url, durationSec, thumbnailUrl, requestedBy }
}
