import { spawn as defaultSpawn } from 'node:child_process'
import { createTrack } from './track.js'
import { SourceError } from './errors.js'

const YT_URL = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i

function collect(stream) {
  return new Promise((resolveP, rejectP) => {
    const chunks = []
    stream.on('data', (c) => chunks.push(c))
    stream.on('end', () => resolveP(Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')))
    stream.on('error', rejectP)
  })
}

export async function resolve(query, requestedBy, { spawn = defaultSpawn } = {}) {
  const target = YT_URL.test(query) ? query : `ytsearch1:${query}`
  const args = ['--no-playlist', '--dump-single-json', target]
  const child = spawn('yt-dlp', args)
  const [stdout, stderr, code] = await Promise.all([
    collect(child.stdout),
    collect(child.stderr),
    new Promise((r) => child.on('close', r)),
  ])
  if (code !== 0) {
    throw new SourceError(stderr.trim() || `yt-dlp exited with code ${code}`)
  }
  let json
  try {
    json = JSON.parse(stdout)
  } catch {
    throw new SourceError('yt-dlp returned invalid JSON')
  }
  return [
    createTrack({
      title: json.title,
      url: json.webpage_url,
      durationSec: json.duration ?? 0,
      thumbnailUrl: json.thumbnail ?? null,
      requestedBy,
    }),
  ]
}

export function stream(track, { spawn = defaultSpawn } = {}) {
  const args = ['-o', '-', '-f', 'bestaudio', '--no-playlist', track.url]
  const child = spawn('yt-dlp', args)
  return child.stdout
}
