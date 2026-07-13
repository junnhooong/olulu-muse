import type { RequestedBy, Track } from '../types.js'

export interface CreateTrackInput {
  title: string
  url: string
  durationSec: number
  thumbnailUrl?: string | null
  requestedBy: RequestedBy
}

export function createTrack({ title, url, durationSec, thumbnailUrl = null, requestedBy }: CreateTrackInput): Track {
  if (!title || !url || typeof durationSec !== 'number' || !requestedBy) {
    throw new Error('createTrack: title, url, durationSec, requestedBy are required')
  }
  return { title, url, durationSec, thumbnailUrl, requestedBy }
}
