import { spawn as defaultSpawn } from 'node:child_process'
import type { Readable } from 'node:stream'
import { createTrack } from './track.js'
import { SourceError } from './errors.js'
import type { RequestedBy, Track } from '../types.js'

const YT_URL = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i

interface ChildLike {
  stdout: Readable
  stderr: Readable
  on(event: 'close', cb: (code: number | null) => void): void
}

type SpawnFn = (cmd: string, args: string[]) => ChildLike

interface ResolveOptions {
  spawn?: SpawnFn
}

function collect(stream: Readable): Promise<string> {
  return new Promise((resolveP, rejectP) => {
    const chunks: Buffer[] = []
    stream.on('data', (c: Buffer | string) => chunks.push(Buffer.from(c)))
    stream.on('end', () => resolveP(Buffer.concat(chunks).toString('utf8')))
    stream.on('error', rejectP)
  })
}

export async function resolve(
  query: string,
  requestedBy: RequestedBy,
  { spawn = defaultSpawn as unknown as SpawnFn }: ResolveOptions = {},
): Promise<Track[]> {
  const target = YT_URL.test(query) ? query : `ytsearch1:${query}`
  const args = ['--no-playlist', '--dump-single-json', target]
  const child = spawn('yt-dlp', args)
  const [stdout, stderr, code] = await Promise.all([
    collect(child.stdout),
    collect(child.stderr),
    new Promise<number | null>((r) => child.on('close', r)),
  ])
  if (code !== 0) {
    throw new SourceError(stderr.trim() || `yt-dlp exited with code ${code}`)
  }
  let json: { title: string; webpage_url: string; duration?: number; thumbnail?: string }
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

export function stream(track: Pick<Track, 'url'>, { spawn = defaultSpawn as unknown as SpawnFn }: ResolveOptions = {}): Readable {
  const args = ['-o', '-', '-f', 'bestaudio', '--no-playlist', track.url]
  const child = spawn('yt-dlp', args)
  return child.stdout
}
